import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast.css';

export function ToastHost() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      limit={4}
      theme="colored"
      className="qts-toast-root"
      toastClassName="qts-toast"
      progressClassName="qts-toast__progress"
    />
  );
}
