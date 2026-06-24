import { createBrowserRouter, Navigate } from 'react-router-dom';
import { EditorScreen } from '../screens/EditorScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <EditorScreen />,
  },
  {
    path: '/review/:sessionId',
    element: <EditorScreen />,
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
