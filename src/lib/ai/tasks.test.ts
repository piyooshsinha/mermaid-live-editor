import { beforeEach, describe, expect, it, vi } from 'vitest';

const parse = vi.fn();
const stream = vi.fn();

vi.mock('../util/mermaid', () => ({ parse: (code: string) => parse(code) }));
vi.mock('./config.svelte', () => ({
  activeCredentials: () => ({ apiKey: 'k', model: 'test-model' }),
  aiConfig: { providerId: 'openai-compatible' }
}));
vi.mock('./providers', () => ({
  getProvider: () => ({
    stream: (...args: unknown[]) => stream(...args)
  })
}));

const { generateDiagram } = await import('./tasks');

/** Turns fixed chunks into the async iterable a provider would return. */
const respondWith = (...responses: string[]) => {
  let call = 0;
  stream.mockImplementation(async function* () {
    const body = responses[Math.min(call++, responses.length - 1)];
    // Split so the progress callback sees more than one delta.
    for (const chunk of body.match(/[\s\S]{1,8}/g) ?? []) {
      yield chunk;
    }
  });
};

describe('generateDiagram validation loop', () => {
  beforeEach(() => {
    parse.mockReset();
    stream.mockReset();
  });

  it('returns the diagram when the first attempt parses', async () => {
    respondWith('flowchart TD\n  A --> B');
    parse.mockResolvedValue({ diagramType: 'flowchart' });

    const result = await generateDiagram('a to b');

    expect(result).toEqual({ attempts: 1, code: 'flowchart TD\n  A --> B' });
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it('feeds the parser error back and succeeds on retry', async () => {
    respondWith('flowchart TD\n  A -->', 'flowchart TD\n  A --> B');
    parse
      .mockRejectedValueOnce(new Error('Parse error on line 2'))
      .mockResolvedValue({ diagramType: 'flowchart' });

    const result = await generateDiagram('a to b');

    expect(result.attempts).toBe(2);
    expect(result.code).toBe('flowchart TD\n  A --> B');
    expect(result.error).toBeUndefined();

    // The retry must carry the failed attempt plus the parser error, so the
    // model corrects rather than regenerating blind.
    const retryMessages = stream.mock.calls[1][0].messages as { content: string }[];
    expect(retryMessages).toHaveLength(3);
    expect(retryMessages[1].content).toContain('flowchart TD');
    expect(retryMessages[2].content).toContain('Parse error on line 2');
  });

  it('gives up after three attempts and reports the last error', async () => {
    respondWith('not a diagram');
    parse.mockRejectedValue(new Error('No diagram type detected'));

    const result = await generateDiagram('nonsense');

    expect(result.attempts).toBe(3);
    expect(result.error).toContain('No diagram type detected');
    expect(result.code).toBe('not a diagram');
    expect(stream).toHaveBeenCalledTimes(3);
  });

  it('strips fences before parsing and reports streaming progress', async () => {
    respondWith('```mermaid\nflowchart TD\n  A --> B\n```');
    parse.mockResolvedValue({ diagramType: 'flowchart' });

    const phases: string[] = [];
    const result = await generateDiagram('a to b', {
      onProgress: ({ phase }) => phases.push(phase)
    });

    expect(parse).toHaveBeenCalledWith('flowchart TD\n  A --> B');
    expect(result.code).toBe('flowchart TD\n  A --> B');
    expect(phases).toContain('streaming');
    expect(phases.at(-1)).toBe('validating');
  });
});
