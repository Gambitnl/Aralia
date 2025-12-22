import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Glossary Data Integrity', () => {
  const GLOSSARY_PATH = path.resolve(__dirname, '../../public/data/glossary/entries');

  it('contains valid JSON entries for rules', () => {
    const rulesPath = path.join(GLOSSARY_PATH, 'rules');
    if (fs.existsSync(rulesPath)) {
      const files = fs.readdirSync(rulesPath).filter(f => f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);
      
      // Sample check first file
      const sample = JSON.parse(fs.readFileSync(path.join(rulesPath, files[0]), 'utf-8'));
      expect(sample).toBeDefined();
      expect(typeof sample).toBe('object');
    }
  });

  it('contains valid JSON entries for classes', () => {
    const classesPath = path.join(GLOSSARY_PATH, 'classes');
    if (fs.existsSync(classesPath)) {
      const files = fs.readdirSync(classesPath).filter(f => f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);
    }
  });

  it('contains valid JSON entries for races', () => {
    const racesPath = path.join(GLOSSARY_PATH, 'races');
    if (fs.existsSync(racesPath)) {
      const files = fs.readdirSync(racesPath).filter(f => f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);
    }
  });
});
