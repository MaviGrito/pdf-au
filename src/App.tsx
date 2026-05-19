import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import PDFList from './components/PDFList/PDFList';
import Editor from './components/Editor/Editor';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PDFList />} />
          <Route path="/editor/:pdfId" element={<Editor />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
