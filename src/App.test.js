import { act, render } from '@testing-library/react';

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => children,
  Link: ({ children }) => children,
  NavLink: ({ children }) => children,
  Navigate: () => null,
  Route: () => null,
  Routes: () => <div data-testid="application-routes" />,
  useLocation: () => ({ pathname: '/', search: '', state: null }),
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}), { virtual: true });

jest.mock('./services/authClient', () => ({
  getCurrentUserId: jest.fn(async () => null),
  getStoredUserId: jest.fn(() => null),
  validateStoredSession: jest.fn(() => new Promise(() => {})),
}));

import App from './App';
import { validateStoredSession } from './services/authClient';

beforeAll(() => {
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the application router without requiring an authenticated session', async () => {
  let view;
  await act(async () => {
    view = render(<App />);
    await Promise.resolve();
  });
  const { getByTestId } = view;
  expect(getByTestId('application-routes')).toBeInTheDocument();
});

test('profile draft changes from another tab do not restart authentication', async () => {
  await act(async () => {
    render(<App />);
    await Promise.resolve();
  });
  expect(validateStoredSession).toHaveBeenCalledTimes(1);

  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'profile_setup_progress_v1',
      newValue: JSON.stringify({ lastStep: '/profile-setup-2' }),
    }));
    await Promise.resolve();
  });

  expect(validateStoredSession).toHaveBeenCalledTimes(1);
});
