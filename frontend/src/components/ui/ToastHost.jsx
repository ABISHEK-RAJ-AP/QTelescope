import React from 'react';
import { Slide, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast.css';

export function ToastHost() {
  return (
    <ToastContainer
      position="top-right"
      transition={Slide}
      autoClose={5200}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable={false}
      pauseOnHover
      limit={4}
      theme="light"
      icon={false}
      className="qts-toast-root"
      toastClassName="qts-toast"
      bodyClassName="qts-toast__body"
      progressClassName="qts-toast__progress"
    />
  );
}
