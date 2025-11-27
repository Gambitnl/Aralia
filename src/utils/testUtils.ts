import axe from 'axe-core';

export const runAxe = (node: HTMLElement) => {
  axe.run(node, (err, { violations }) => {
    if (err) {
      console.error('axe-core error:', err);
      return;
    }
    if (violations.length > 0) {
      console.warn('Accessibility violations found:', violations);
    }
  });
};
