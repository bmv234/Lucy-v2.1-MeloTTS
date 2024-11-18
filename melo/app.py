# WebUI by mrfakename <X @realmrfakename / HF @mrfakename>
# Demo also available on HF Spaces: https://huggingface.co/spaces/mrfakename/MeloTTS
from typing import Dict, Union, Optional, Tuple
import gradio as gr
import os
import torch
import io
import tempfile
import click
from melo.api import TTS
from tqdm import tqdm

print("Make sure you've downloaded unidic (python -m unidic download) for this WebUI to work.")

# Initialize settings
DEVICE = 'auto'
SUPPORTED_LANGUAGES = ['EN', 'ES', 'FR', 'ZH', 'JP', 'KR']

# Initialize TTS models with error handling
def init_models() -> Dict[str, TTS]:
    models = {}
    for lang in SUPPORTED_LANGUAGES:
        try:
            models[lang] = TTS(language=lang, device=DEVICE)
        except Exception as e:
            print(f"Failed to load {lang} model: {str(e)}")
    return models

models = init_models()
speaker_ids = models['EN'].hps.data.spk2id if 'EN' in models else {}

default_text_dict = {
    'EN': 'The field of text-to-speech has seen rapid development recently.',
    'ES': 'El campo de la conversión de texto a voz ha experimentado un rápido desarrollo recientemente.',
    'FR': 'Le domaine de la synthèse vocale a connu un développement rapide récemment',
    'ZH': 'text-to-speech 领域近年来发展迅速',
    'JP': 'テキスト読み上げの分野は最近急速な発展を遂げています',
    'KR': '최근 텍스트 음성 변환 분야가 급속도로 발전하고 있습니다.',    
}

def synthesize(
    speaker: str,
    text: str,
    speed: float,
    language: str
) -> str:
    """
    Synthesize text to speech using the selected model and parameters.
    
    Args:
        speaker: The speaker ID to use
        text: The text to synthesize
        speed: The speed factor for synthesis
        language: The language to use
    
    Returns:
        The path to the synthesized audio file
    """
    if language not in models:
        raise ValueError(f"Language {language} not supported")
    
    # Create a temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    temp_file.close()
    
    models[language].tts_to_file(
        text,
        models[language].hps.data.spk2id[speaker],
        temp_file.name,
        speed=speed,
        pbar=tqdm
    )
    return temp_file.name

def load_speakers(
    language: str,
    text: str
) -> Tuple[gr.update, str]:
    """
    Update the available speakers for the selected language.
    
    Args:
        language: The selected language
        text: The current text input
    
    Returns:
        Tuple containing speaker update and new text
    """
    if language not in models:
        raise ValueError(f"Language {language} not supported")
    
    newtext = default_text_dict[language] if text in default_text_dict.values() else text
    return (
        gr.update(
            value=list(models[language].hps.data.spk2id.keys())[0],
            choices=list(models[language].hps.data.spk2id.keys())
        ),
        newtext
    )

# Create Gradio interface
with gr.Blocks(theme=gr.themes.Default()) as demo:
    gr.Markdown('# MeloTTS WebUI\n\nA WebUI for MeloTTS.')
    
    with gr.Group():
        speaker = gr.Dropdown(
            choices=list(speaker_ids.keys()),
            interactive=True,
            value='EN-US',
            label='Speaker'
        )
        language = gr.Radio(
            choices=SUPPORTED_LANGUAGES,
            label='Language',
            value='EN'
        )
        speed = gr.Slider(
            label='Speed',
            minimum=0.1,
            maximum=10.0,
            value=1.0,
            interactive=True,
            step=0.1
        )
        text = gr.Textbox(
            label="Text to speak",
            value=default_text_dict['EN'],
            lines=3
        )
        
        # Update speakers when language changes
        language.input(
            fn=load_speakers,
            inputs=[language, text],
            outputs=[speaker, text]
        )
    
    with gr.Row():
        btn = gr.Button('Synthesize', variant='primary')
        aud = gr.Audio(interactive=False, type='filepath')
    
    # Synthesis event
    btn.click(
        fn=synthesize,
        inputs=[speaker, text, speed, language],
        outputs=[aud]
    )
    
    gr.Markdown('WebUI by [mrfakename](https://twitter.com/realmrfakename).')

@click.command()
@click.option(
    '--share',
    '-s',
    is_flag=True,
    show_default=True,
    default=False,
    help="Expose a publicly-accessible shared Gradio link usable by anyone with the link. Only share the link with people you trust."
)
@click.option('--host', '-h', default=None, help="Host to bind to")
@click.option('--port', '-p', type=int, default=None, help="Port to bind to")
def main(share: bool, host: Optional[str], port: Optional[int]) -> None:
    """Launch the MeloTTS WebUI."""
    demo.queue(api_open=False).launch(
        show_api=False,
        share=share,
        server_name=host,
        server_port=port
    )

if __name__ == "__main__":
    main()
