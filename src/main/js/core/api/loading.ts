/**
 * Loading State Manager
 * Manages loading states for API operations
 */

import type { LoadingState } from './types';

type LoadingListener = (state: LoadingState) => void;

export class LoadingManager {
  private loadingStates: Map<string, LoadingState> = new Map();
  private listeners: Set<LoadingListener> = new Set();
  private globalLoading: boolean = false;

  /**
   * Start loading for an operation
   */
  startLoading(operation: string, progress?: number): void {
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
  updateProgress(operation: string, progress: number): void {
    const state = this.loadingStates.get(operation);
    
    if (state) {
      state.progress = progress;
      this.notifyListeners();
    }
  }

  /**
   * Stop loading for an operation
   */
  stopLoading(operation: string): void {
    this.loadingStates.delete(operation);
    this.updateGlobalState();
    this.notifyListeners();
  }

  /**
   * Check if any operation is loading
   */
  isLoading(operation?: string): boolean {
    if (operation) {
      return this.loadingStates.has(operation);
    }
    return this.globalLoading;
  }

  /**
   * Get loading state for an operation
   */
  getLoadingState(operation: string): LoadingState | undefined {
    return this.loadingStates.get(operation);
  }

  /**
   * Get all loading operations
   */
  getActiveOperations(): string[] {
    return Array.from(this.loadingStates.keys());
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(listener: LoadingListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update global loading state
   */
  private updateGlobalState(): void {
    this.globalLoading = this.loadingStates.size > 0;
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const currentState: LoadingState = {
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
  clear(): void {
    this.loadingStates.clear();
    this.globalLoading = false;
    this.notifyListeners();
  }
}

// Export singleton instance
export const loadingManager = new LoadingManager();

// Helper function for automatic loading management
export function withLoading<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
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