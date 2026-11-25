"""Genera tests/datos/fbank-referencia.json: audios cortos y su fbank según lhotse.

Se corre UNA vez (el resultado va al repositorio); la prueba tests/fbank.test.js
compara js/core/habla/fbank.js contra este archivo.

    python -m venv venv && venv\\Scripts\\pip install numpy lhotse soundfile urllib3 requests lilcom
    venv\\Scripts\\python herramientas/habla/fbank-referencia.py

Tres audios de 16 kHz (guardados como enteros de 16 bits, así JavaScript parte de
las mismas muestras exactas: muestra / 32768):
  - silencio: ceros (prueba el piso del logaritmo);
  - tono: seno de 440 Hz;
  - voz sintética: tren de pulsos de 120 Hz con tres formantes de una «a» y un
    poco de ruido (semilla fija).
Longitudes que NO son múltiplo de 160 para probar los bordes (snip_edges=False).
"""
import json
import pathlib

import numpy as np
from lhotse.features.kaldi.extractors import Fbank, FbankConfig

SR = 16000
RAIZ = pathlib.Path(__file__).resolve().parents[2]


def a_int16(x):
    return np.clip(np.round(x * 32767), -32768, 32767).astype(np.int16)


def resonador(x, f, ancho):
    """Filtro de dos polos (formante) aplicado a x."""
    r = np.exp(-np.pi * ancho / SR)
    a1 = -2 * r * np.cos(2 * np.pi * f / SR)
    a2 = r * r
    y = np.zeros_like(x)
    for i in range(len(x)):
        y[i] = x[i] - a1 * (y[i - 1] if i > 0 else 0) - a2 * (y[i - 2] if i > 1 else 0)
    return y


def voz(n):
    rng = np.random.default_rng(7)
    pulsos = np.zeros(n)
    pulsos[:: SR // 120] = 1.0
    y = pulsos
    for f, ancho in ((730, 90), (1090, 110), (2440, 160)):
        y = resonador(y, f, ancho)
    y = y / np.max(np.abs(y)) * 0.6 + rng.normal(0, 0.01, n)
    # entra y sale con un poco de silencio, como una palabra de verdad
    y[: n // 8] *= 0.02
    y[-n // 8 :] *= 0.02
    return y


def main():
    audios = {
        "silencio": np.zeros(8123),
        "tono": 0.5 * np.sin(2 * np.pi * 440 * np.arange(9000) / SR),
        "voz": voz(12345),
    }
    extractor = Fbank(FbankConfig())  # dither=0, snip_edges=False, 80 bandas
    salida = {"config": {k: v for k, v in FbankConfig().to_dict().items()}, "casos": []}
    for nombre, onda in audios.items():
        pcm = a_int16(onda)
        flotante = (pcm.astype(np.float32) / 32768.0)[None, :]
        feats = extractor.extract(flotante, SR)
        salida["casos"].append(
            {
                "nombre": nombre,
                "pcm": pcm.tolist(),
                "cuadros": int(feats.shape[0]),
                "bandas": int(feats.shape[1]),
                "fbank": [[round(float(v), 6) for v in fila] for fila in feats],
            }
        )
        print(nombre, len(pcm), "muestras ->", feats.shape)
    destino = RAIZ / "tests" / "datos" / "fbank-referencia.json"
    destino.parent.mkdir(exist_ok=True)
    destino.write_text(json.dumps(salida, separators=(",", ":")), encoding="utf-8")
    print("escrito", destino, destino.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
