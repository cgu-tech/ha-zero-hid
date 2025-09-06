export class SortedLinkedMap {
  constructor(comparator = (a, b) => a < b ? -1 : a > b ? 1 : 0) {
    this.map = new Map();
    this.comparator = comparator;
    this.sortedKeys = [];
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.get(key).value = value;
      return;
    }

    // Find insertion point (linear for simplicity)
    let index = 0;
    while (index < this.sortedKeys.length && this.comparator(this.sortedKeys[index], key) < 0) {
      index++;
    }

    // Insert key into sorted array
    this.sortedKeys.splice(index, 0, key);

    // Determine prev/next keys
    const prevKey = this.sortedKeys[index - 1] ?? null;
    const nextKey = this.sortedKeys[index + 1] ?? null;

    // Create wrapper
    const wrapper = { value, prev: prevKey, next: nextKey };
    this.map.set(key, wrapper);

    // Update neighbors
    if (prevKey !== null) this.map.get(prevKey).next = key;
    if (nextKey !== null) this.map.get(nextKey).prev = key;
  }

  get(key) {
    return this.map.get(key)?.value;
  }

  nextKey(key) {
    return this.map.get(key)?.next ?? null;
  }

  prevKey(key) {
    return this.map.get(key)?.prev ?? null;
  }

  delete(key) {
    if (!this.map.has(key)) return;

    const { prev, next } = this.map.get(key);
    if (prev !== null) this.map.get(prev).next = next;
    if (next !== null) this.map.get(next).prev = prev;

    this.map.delete(key);
    this.sortedKeys = this.sortedKeys.filter(k => k !== key);
  }

  *entries() {
    for (const key of this.sortedKeys) {
      yield [key, this.get(key)];
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}
