import { createBrowserRouter } from 'react-router-dom';
import { SetupScreen } from '../screens/SetupScreen';
import { DetailsScreen } from '../screens/DetailsScreen';
import { EditorScreen } from '../screens/EditorScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SetupScreen />,
  },
  {
    path: '/details',
    element: <DetailsScreen />,
  },
  {
    path: '/editor',
    element: <EditorScreen />,
  },
]);
