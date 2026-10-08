// Vite bundles garu-ko WASM/model for GitHub Pages. No manuscript is uploaded.
import { Garu } from 'garu-ko';

const status = () => document.getElementById('engineStatus');
try {
  const garu = await Garu.load();
  // Window hook is kept deliberately small for later dashboard integration.
  window.setMorphologyEngine?.(garu);
} catch (error) {
  console.error('Garu load error', error);
  if (status()) status().textContent = '형태소 분석기를 불러오지 못했습니다. 제한적인 기본 규칙으로 검사합니다.';
}
