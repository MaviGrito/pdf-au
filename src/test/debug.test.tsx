import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

describe('debug test 1', () => {
  it('basic render works', () => {
    const { container } = render(<div>hello</div>);
    expect(container.textContent).toBe('hello');
  });
});

describe('debug test 2', () => {
  it('second describe works', () => {
    expect(true).toBe(true);
  });
});
