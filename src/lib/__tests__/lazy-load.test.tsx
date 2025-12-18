// Example unit test for lazy-load utility
import { createLazyComponent } from '@/lib/lazy-load';
import { render, screen, waitFor } from '@testing-library/react';

// Mock component for testing
const MockComponent = () => <div>Test Component</div>;

describe('createLazyComponent', () => {
    it('should load component lazily', async () => {
        const LazyComponent = createLazyComponent(
            () => Promise.resolve({ default: MockComponent })
        );

        render(<LazyComponent />);

        // Should show loading state initially
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText('Test Component')).toBeInTheDocument();
        });
    });

    it('should use custom loading component', async () => {
        const CustomLoader = () => <div>Custom Loading...</div>;
        const LazyComponent = createLazyComponent(
            () => Promise.resolve({ default: MockComponent }),
            { loading: CustomLoader }
        );

        render(<LazyComponent />);

        // Should show custom loading state
        expect(screen.getByText('Custom Loading...')).toBeInTheDocument();

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText('Test Component')).toBeInTheDocument();
        });
    });
});
