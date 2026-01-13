import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { NotificationContextProvider } from "./contexts/NotificationContext";

import Login from "./components/Login";
import Chat from "./components/Chat";
import Navbar from "./components/Navbar";
import { Conversations } from "./components/Conversations";
import { ActiveConversations } from "./components/ActiveConversation";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AuthProvider>
              <NotificationContextProvider>
                <Navbar />
              </NotificationContextProvider>
            </AuthProvider>
          }
        >
          <Route
            index
            element={
              <ProtectedRoute>w
                <ActiveConversations />
              </ProtectedRoute>
            }
          />
          <Route path="users" element={
            <ProtectedRoute>
              <Conversations />
            </ProtectedRoute>
          } />
          <Route path="chats/:conversationName" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>}
          />
          <Route path="login" element={<Login />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}