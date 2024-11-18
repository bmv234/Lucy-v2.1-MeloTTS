import os
import re
import json
import torch
import librosa
import soundfile
import torchaudio
import numpy as np
import torch.nn as nn
from tqdm import tqdm
import torch

from . import utils
from . import commons
from .models import SynthesizerTrn
from .split_utils import split_sentence
from .mel_processing import spectrogram_torch, spectrogram_torch_conv
from .download_utils import load_or_download_config, load_or_download_model

class TTS(nn.Module):
    def __init__(self, 
                language,
                device='auto',
                use_hf=True,
                config_path=None,
                ckpt_path=None):
        super().__init__()
        if device == 'auto':
            device = 'cpu'
            if torch.cuda.is_available(): device = 'cuda'
            if torch.backends.mps.is_available(): device = 'mps'
        if 'cuda' in device:
            assert torch.cuda.is_available()

        # config_path = 
        hps = load_or_download_config(language, use_hf=use_hf, config_path=config_path)

        num_languages = hps.num_languages
        num_tones = hps.num_tones
        symbols = hps.symbols

        model = SynthesizerTrn(
            len(symbols),
            hps.data.filter_length // 2 + 1,
            hps.train.segment_size // hps.data.hop_length,
            n_speakers=hps.data.n_speakers,
            num_tones=num_tones,
            num_languages=num_languages,
            **hps.model,
        ).to(device)

        model.eval()
        self.model = model
        self.symbol_to_id = {s: i for i, s in enumerate(symbols)}
        self.id_to_symbol = {i: s for s, i in self.symbol_to_id.items()}
        self.hps = hps
        self.device = device
    
        # load state_dict
        checkpoint_dict = load_or_download_model(language, device, use_hf=use_hf, ckpt_path=ckpt_path)
        self.model.load_state_dict(checkpoint_dict['model'], strict=True)
        
        language = language.split('_')[0]
        self.language = 'ZH_MIX_EN' if language == 'ZH' else language # we support a ZH_MIX_EN model

    @staticmethod
    def audio_numpy_concat(segment_data_list, sr, speed=1.):
        audio_segments = []
        current_time = 0
        timing_info = []
        
        for segment_data, segment_timing in segment_data_list:
            # Add segment audio
            segment_samples = segment_data.reshape(-1).tolist()
            audio_segments += segment_samples
            
            # Update timing information with absolute time
            for timing in segment_timing:
                timing['start'] += current_time
                timing['end'] += current_time
                timing_info.append(timing)
            
            # Add silence and update current time
            silence_duration = int((sr * 0.05) / speed)
            audio_segments += [0] * silence_duration
            current_time += (len(segment_samples) + silence_duration) / sr
            
        audio_segments = np.array(audio_segments).astype(np.float32)
        return audio_segments, timing_info

    @staticmethod
    def split_sentences_into_pieces(text, language, quiet=False):
        texts = split_sentence(text, language_str=language)
        if not quiet:
            print(" > Text split to sentences.")
            print('\n'.join(texts))
            print(" > ===========================")
        return texts

    def get_word_timings_from_attention(self, attn, phones, audio_duration, speed=1.0):
        """Calculate word timings based on attention alignments."""
        # Convert phone IDs to symbols
        phone_symbols = [self.id_to_symbol[pid] for pid in phones]
        
        # Get word boundaries from phones
        word_boundaries = []
        current_word = []
        current_word_text = []
        current_start_idx = 0
        
        for i, phone in enumerate(phone_symbols):
            if phone in ['|', '#']:  # Word boundary tokens
                if current_word:
                    word_boundaries.append({
                        'word': ''.join(current_word_text),
                        'start_idx': current_start_idx,
                        'end_idx': i
                    })
                    current_word = []
                    current_word_text = []
                    current_start_idx = i + 1
            else:
                current_word.append(phone)
                # Only add to text if it's a visible character
                if not phone.startswith('@') and not phone.startswith('#'):
                    current_word_text.append(phone)
        
        # Add last word if exists
        if current_word:
            word_boundaries.append({
                'word': ''.join(current_word_text),
                'start_idx': current_start_idx,
                'end_idx': len(phone_symbols)
            })
        
        # Convert attention to numpy for easier processing
        attn_numpy = attn.squeeze().cpu().numpy()
        
        # Calculate time per output frame
        time_per_frame = audio_duration / attn_numpy.shape[0]
        
        # Get word timings from attention
        word_timings = []
        for i, boundary in enumerate(word_boundaries):
            # Get attention for this word's phones
            word_attn = attn_numpy[:, boundary['start_idx']:boundary['end_idx']]
            
            # Find start and end frames where attention is highest
            word_frames = word_attn.sum(axis=1)
            active_frames = np.where(word_frames > word_frames.max() * 0.1)[0]
            
            if len(active_frames) > 0:
                start_frame = active_frames[0]
                end_frame = active_frames[-1]
                
                # Add a small buffer between words
                if i > 0:
                    start_frame = max(0, start_frame - 1)
                if i < len(word_boundaries) - 1:
                    end_frame = min(attn_numpy.shape[0] - 1, end_frame + 1)
                
                word_timings.append({
                    'word': boundary['word'],
                    'start': start_frame * time_per_frame,
                    'end': (end_frame + 1) * time_per_frame,
                    'index': i
                })
        
        return word_timings

    def tts_to_file_with_timing(self, text, speaker_id, output_path=None, sdp_ratio=0.2, noise_scale=0.6, noise_scale_w=0.8, speed=1.0, pbar=None, format=None, position=None, quiet=False):
        language = self.language
        texts = self.split_sentences_into_pieces(text, language, quiet)
        audio_list = []
        
        if pbar:
            tx = pbar(texts)
        else:
            if position:
                tx = tqdm(texts, position=position)
            elif quiet:
                tx = texts
            else:
                tx = tqdm(texts)
                
        for t in tx:
            if language in ['EN', 'ZH_MIX_EN']:
                t = re.sub(r'([a-z])([A-Z])', r'\1 \2', t)
            
            device = self.device
            bert, ja_bert, phones, tones, lang_ids = utils.get_text_for_tts_infer(t, language, self.hps, device, self.symbol_to_id)
            
            with torch.no_grad():
                x_tst = phones.to(device).unsqueeze(0)
                tones = tones.to(device).unsqueeze(0)
                lang_ids = lang_ids.to(device).unsqueeze(0)
                bert = bert.to(device).unsqueeze(0)
                ja_bert = ja_bert.to(device).unsqueeze(0)
                x_tst_lengths = torch.LongTensor([phones.size(0)]).to(device)
                speakers = torch.LongTensor([speaker_id]).to(device)
                
                # Generate audio with attention alignments
                audio, attn, _, _ = self.model.infer(
                    x_tst,
                    x_tst_lengths,
                    speakers,
                    tones,
                    lang_ids,
                    bert,
                    ja_bert,
                    sdp_ratio=sdp_ratio,
                    noise_scale=noise_scale,
                    noise_scale_w=noise_scale_w,
                    length_scale=1. / speed,
                )
                audio = audio[0, 0].data.cpu().float().numpy()
                
                # Calculate word timings using attention
                audio_duration = len(audio) / self.hps.data.sampling_rate
                word_timings = self.get_word_timings_from_attention(attn, phones.tolist(), audio_duration, speed)
                
                audio_list.append((audio, word_timings))
                
                del x_tst, tones, lang_ids, bert, ja_bert, x_tst_lengths, speakers
                
        torch.cuda.empty_cache()
        
        # Concatenate audio segments and merge timing information
        audio, timing_info = self.audio_numpy_concat(audio_list, sr=self.hps.data.sampling_rate, speed=speed)

        if output_path is None:
            return audio, timing_info
        else:
            if format:
                soundfile.write(output_path, audio, self.hps.data.sampling_rate, format=format)
            else:
                soundfile.write(output_path, audio, self.hps.data.sampling_rate)
            return audio, timing_info

    def tts_to_file(self, text, speaker_id, output_path=None, sdp_ratio=0.2, noise_scale=0.6, noise_scale_w=0.8, speed=1.0, pbar=None, format=None, position=None, quiet=False):
        """Legacy method for backward compatibility"""
        audio, _ = self.tts_to_file_with_timing(
            text, speaker_id, output_path, sdp_ratio, noise_scale, 
            noise_scale_w, speed, pbar, format, position, quiet
        )
        return audio
