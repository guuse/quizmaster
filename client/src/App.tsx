import { Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { Landing } from "./screens/Landing";
import { RoomRoute } from "./screens/RoomPage";
import { RoomCreate } from "./screens/RoomCreate";

/**
 * Deep-linkable, refresh-safe routes (the server SPA-fallbacks every non-/api,
 * non-/socket.io path to index.html):
 *   /               landing / create / join-by-code
 *   /join/:code     join a room by its shared link (no login needed)
 *   /room/:code     the room you created / are playing in
 *   /room/:code/new host generates a new quiz for the same room
 */
export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join/:code" element={<RoomRoute />} />
        <Route path="/room/:code/new" element={<RoomCreate />} />
        <Route path="/room/:code" element={<RoomRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
