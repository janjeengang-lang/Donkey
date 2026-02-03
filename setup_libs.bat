cd dubbing
curl -L -o transformers.min.js https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0/dist/transformers.min.js
curl -L -o ort.js https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.min.js
curl -L -o ort-wasm.wasm https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort-wasm.wasm
curl -L -o ort-wasm-simd.wasm https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort-wasm-simd.wasm
curl -L -o ort-wasm-threaded.wasm https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort-wasm-threaded.wasm

echo.
echo Libraries Downloaded Successfully.
pause
