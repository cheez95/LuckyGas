/**
 * Loading State Manager (JavaScript version)
 * Manages loading states for API operations
 */

export class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
    this.listeners = new Set();
    this.globalLoading = false;
  }

  /**
   * Start loading for an operation
   */
  startLoading(operation, progress) {
    this.loadingStates.set(operation, {
      isLoading: true,
      operation,
      progress
    });
    
    this.updateGlobalState();
    this.notifyListeners();
  }

  /**
   * Update loading progress
   */
  updateProgress(operation, progress) {
    const state = this.loadingStates.get(operation);
    
    if (state) {
      state.progress = progress;
      this.notifyListeners();
    }
  }

  /**
   * Stop loading for an operation
   */
  stopLoading(operation) {
    this.loadingStates.delete(operation);
    this.updateGlobalState();
    this.notifyListeners();
  }

  /**
   * Check if any operation is loading
   */
  isLoading(operation) {
    if (operation) {
      return this.loadingStates.has(operation);
    }
    return this.globalLoading;
  }

  /**
   * Get loading state for an operation
   */
  getLoadingState(operation) {
    return this.loadingStates.get(operation);
  }

  /**
   * Get all loading operations
   */
  getActiveOperations() {
    return Array.from(this.loadingStates.keys());
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update global loading state
   */
  updateGlobalState() {
    this.globalLoading = this.loadingStates.size > 0;
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    const currentState = {
      isLoading: this.globalLoading,
      operation: this.getActiveOperations().join(', ')
    };

    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('Error in loading listener:', error);
      }
    });
  }

  /**
   * Clear all loading states
   */
  clear() {
    this.loadingStates.clear();
    this.globalLoading = false;
    this.notifyListeners();
  }
}

// Export singleton instance
export const loadingManager = new LoadingManager();

// Helper function for automatic loading management
export function withLoading(operation, fn) {
  loadingManager.startLoading(operation);
  
  return fn()
    .then(result => {
      loadingManager.stopLoading(operation);
      return result;
    })
    .catch(error => {
      loadingManager.stopLoading(operation);
      throw error;
    });
}