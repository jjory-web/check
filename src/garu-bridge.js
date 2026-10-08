// Vite bundles garu-ko WASM/model for GitHub Pages. No manuscript is uploaded.
import { Garu } from 'garu-ko';
import {loadHeadwords} from './dictionary-bridge.js';

const status = () => document.getElementById('engineStatus');
try {
  const garu = await Garu.load();
  // Window hook is kept deliberately small for later dashboard integration.
  window.setMorphologyEngine?.(garu);
  // Run a harmless smoke test, including a POS-tagged token.
  const test=garu.analyze("학생이 글을 읽었다.");
  if (!Array.isArray(test.tokens) || !test.tokens.some(t=>t.pos)) throw new Error("형태소 분석 결과가 비어 있습니다");
  window.setEngineDiagnostics?.({garu:true,tokens:test.tokens.length});
} catch (error) {
  console.error('Garu load error', error);
  if (status()) status().textContent = '형태소 분석기를 불러오지 못했습니다. 제한적인 기본 규칙으로 검사합니다.';
}

try { const result=await loadHeadwords();window.setEngineDiagnostics?.({dictionary:result.loaded,count:result.count,reason:result.reason}); } catch(err){console.warn("Dictionary load failed",err);window.setEngineDiagnostics?.({dictionary:false,reason:err.message});}
