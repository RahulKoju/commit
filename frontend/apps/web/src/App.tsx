import { createBrowserRouter, RouterProvider } from "react-router-dom"

import { AuthLayout } from "@/components/AuthLayout"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { HomePage } from "@/pages/HomePage"
import { LoginPage } from "@/pages/LoginPage"
import { ResetPasswordPage } from "@/pages/ResetPasswordPage"
import { SignupPage } from "@/pages/SignupPage"

const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
