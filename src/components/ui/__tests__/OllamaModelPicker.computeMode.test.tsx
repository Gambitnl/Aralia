/** The player explicitly chooses local CPU processing in the existing picker.
 * Defaults and model selection remain separate from the processing choice. */
import React from 'react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {OllamaModelPicker} from '../OllamaModelPicker';
import {getOllamaComputeMode,setOllamaComputeMode,getOllamaModelChoice} from '../../../services/ai/aiProviderSettings';
vi.mock('../../../services/ollama/client',()=>({OllamaClient:class{}}));
const installed=async()=>['phi4-mini:3.8b-q4_K_M'];
describe('local processing picker',()=>{
 beforeEach(()=>localStorage.clear());
 it('offers an explicit CPU choice without changing the selected model',async()=>{
  render(<OllamaModelPicker listInstalled={installed}/>);
  const select=await screen.findByRole('combobox',{name:'Dialogue (NPC and companion voices) processing'});
  expect(select).toHaveValue('auto');fireEvent.change(select,{target:{value:'cpu'}});
  expect(getOllamaComputeMode('dialogue')).toBe('cpu');expect(select).toHaveValue('cpu');
  expect(getOllamaComputeMode('judgment')).toBe('auto');expect(getOllamaModelChoice('dialogue')).toBeNull();
 });
 it('shows the saved choice and can restore Automatic',async()=>{
  setOllamaComputeMode('dialogue','cpu');render(<OllamaModelPicker listInstalled={installed}/>);
  const select=await screen.findByRole('combobox',{name:'Dialogue (NPC and companion voices) processing'});
  expect(select).toHaveValue('cpu');fireEvent.change(select,{target:{value:'auto'}});
  expect(getOllamaComputeMode('dialogue')).toBe('auto');
 });
});
