// Example test for ErrorBoundary component
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { userEvent } from '@testing-library/user-event';

// Component that throws an error
const ThrowError = () => {
    throw new Error('Test error');
};

// Component that works fine
const WorkingComponent = () => <div>Working Component</div>;

describe('ErrorBoundary', () => {
    // Suppress console.error for these tests
    beforeAll(() => {
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('should render children when there is no error', () => {
        render(
            <ErrorBoundary>
                <WorkingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Working Component')).toBeInTheDocument();
    });

    it('should display error UI when child component throws', () => {
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should render custom fallback when provided', () => {
        const fallback = <div>Custom Error Message</div>;

        render(
            <ErrorBoundary fallback={fallback}>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Custom Error Message')).toBeInTheDocument();
    });

    it('should reset error state when try again is clicked', async () => {
        const user = userEvent.setup();

        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        const tryAgainButton = screen.getByRole('button', { name: /try again/i });
        await user.click(tryAgainButton);

        // After clicking, it should attempt to re-render
        // Note: In a real test, you'd want to test with a component that can recover
    });
});
