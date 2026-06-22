import { createBrowserRouter, Navigate } from 'react-router-dom';
import { EditorScreen } from '../screens/EditorScreen';
import ReviewScreen from '../features/review/ReviewScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <EditorScreen />,
  },
  {
    path: '/review/:sessionId',
    element: <ReviewScreen />,
  },
  {
    path: '/setup',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/details',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/editor',
    element: <Navigate to="/" replace />,
  },
]);
