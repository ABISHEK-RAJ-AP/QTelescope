import React, { useEffect, useRef } from 'react';

const Terminal = ({ logs }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    
    <div className="console">
      <div className="header">TERMINAL OUTPUT</div>
      <div className="console-content">
        {logs.map((log) => (
          <div key={log.id} className={`log-${log.type}`}>
            &gt; {log.msg}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Terminal;