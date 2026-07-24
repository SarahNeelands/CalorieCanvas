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

beforeAll(() => {
  window.scrollTo = jest.fn();
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
