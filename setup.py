import os 
from setuptools import setup, find_packages
from setuptools.command.develop import develop
from setuptools.command.install import install

# Read the contents of README.md
with open('README.md', encoding='utf-8') as f:
    long_description = f.read()

# Read requirements.txt
with open('requirements.txt') as f:
    reqs = f.read().splitlines()

class PostInstallCommand(install):
    """Post-installation for installation mode."""
    def run(self):
        install.run(self)
        os.system('python -m unidic download')


class PostDevelopCommand(develop):
    """Post-installation for development mode."""
    def run(self):
        develop.run(self)
        os.system('python -m unidic download')

setup(
    name='melotts',
    version='0.1.2',
    description='A Text-to-Speech system supporting multiple languages',
    long_description=long_description,
    long_description_content_type='text/markdown',
    author='MeloTTS Team',
    url='https://github.com/owner/MeloTTS',
    packages=find_packages(include=['melo', 'melo.*']),
    include_package_data=True,
    install_requires=reqs,
    python_requires='>=3.12',
    package_data={
        '': ['*.txt', 'cmudict_*', '*.json'],
    },
    entry_points={
        "console_scripts": [
            "melotts = melo.main:main",
            "melo = melo.main:main",
            "melo-ui = melo.app:main",
        ],
    },
    cmdclass={
        'develop': PostDevelopCommand,
        'install': PostInstallCommand,
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.12',
        'Operating System :: OS Independent',
        'Topic :: Multimedia :: Sound/Audio :: Speech',
        'Topic :: Scientific/Engineering :: Artificial Intelligence',
    ],
    keywords='text-to-speech, tts, speech synthesis, deep learning, machine learning',
)
