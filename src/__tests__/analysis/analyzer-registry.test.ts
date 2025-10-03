import { AnalyzerRegistry, IAnalyzer } from '../../analysis/analyzer-interface.js';
import { Issue, Suggestion } from '../../types/index.js';

// Mock analyzer for testing
class MockAnalyzer implements IAnalyzer {
  constructor(public readonly type: string) {}

  async analyze(_imagePath: string): Promise<{ mock: string }> {
    return { mock: 'data' };
  }

  detectIssues(_analysis: { mock: string }): Issue[] {
    return [
      {
        type: this.type,
        severity: 'low',
        description: `Mock issue from ${this.type}`
      }
    ];
  }

  generateSuggestions(_issues: Issue[]): Suggestion[] {
    return [
      {
        type: 'general',
        title: `Mock suggestion for ${this.type}`,
        description: 'Mock description',
        priority: 1
      }
    ];
  }
}

describe('AnalyzerRegistry', () => {
  let registry: AnalyzerRegistry;

  beforeEach(() => {
    registry = new AnalyzerRegistry();
  });

  describe('register', () => {
    it('registers an analyzer', () => {
      const analyzer = new MockAnalyzer('test');
      registry.register(analyzer);

      expect(registry.has('test')).toBe(true);
    });

    it('allows registering multiple analyzers', () => {
      registry.register(new MockAnalyzer('color'));
      registry.register(new MockAnalyzer('layout'));

      expect(registry.has('color')).toBe(true);
      expect(registry.has('layout')).toBe(true);
    });
  });

  describe('get', () => {
    it('retrieves a registered analyzer', () => {
      const analyzer = new MockAnalyzer('test');
      registry.register(analyzer);

      const retrieved = registry.get('test');
      expect(retrieved).toBe(analyzer);
    });

    it('returns undefined for unregistered analyzer', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns all registered analyzers', () => {
      registry.register(new MockAnalyzer('color'));
      registry.register(new MockAnalyzer('layout'));

      const all = registry.getAll();
      expect(all.length).toBe(2);
    });

    it('returns empty array when no analyzers registered', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('getForPriorities', () => {
    beforeEach(() => {
      registry.register(new MockAnalyzer('color'));
      registry.register(new MockAnalyzer('layout'));
    });

    it('returns color analyzer for colors priority', () => {
      const analyzers = registry.getForPriorities(['colors']);
      expect(analyzers.length).toBe(1);
      expect(analyzers[0]?.type).toBe('color');
    });

    it('returns layout analyzer for layout priority', () => {
      const analyzers = registry.getForPriorities(['layout']);
      expect(analyzers.length).toBe(1);
      expect(analyzers[0]?.type).toBe('layout');
    });

    it('returns layout analyzer for spacing priority', () => {
      const analyzers = registry.getForPriorities(['spacing']);
      expect(analyzers.length).toBe(1);
      expect(analyzers[0]?.type).toBe('layout');
    });

    it('returns both analyzers for multiple priorities', () => {
      const analyzers = registry.getForPriorities(['colors', 'layout']);
      expect(analyzers.length).toBe(2);
    });

    it('does not duplicate layout analyzer for related priorities', () => {
      const analyzers = registry.getForPriorities(['layout', 'spacing', 'typography']);
      expect(analyzers.length).toBe(1);
      expect(analyzers[0]?.type).toBe('layout');
    });

    it('returns empty array for unrecognized priorities', () => {
      const analyzers = registry.getForPriorities(['unknown']);
      expect(analyzers.length).toBe(0);
    });
  });

  describe('clear', () => {
    it('removes all registered analyzers', () => {
      registry.register(new MockAnalyzer('test'));
      registry.clear();

      expect(registry.has('test')).toBe(false);
      expect(registry.getAll()).toEqual([]);
    });
  });
});
