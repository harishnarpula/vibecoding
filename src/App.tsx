import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useTheme } from "./Finvibe/hooks/useTheme";
import CodeExplorer from "./Finvibe/components/CodeExplorer";
import { UsecasesList } from "./Finvibe/usecases";

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<CodeExplorer theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/usecases" element={<UsecasesList theme={theme} onToggleTheme={toggleTheme} />} />
      </Routes>
    </Router>
  );
}
