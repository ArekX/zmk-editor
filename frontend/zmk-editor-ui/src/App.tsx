import { Route, Routes } from "react-router"

import { EditorPage } from "@/routes/EditorPage"
import { HomePage } from "@/routes/HomePage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/repos/:id" element={<EditorPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}
