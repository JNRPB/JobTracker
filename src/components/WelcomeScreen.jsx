import { useState, useEffect } from "react";

function WelcomeScreen() {
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    fetch("http://192.168.0.22:3001/api/storage")
      .then((res) => res.json())
      .then((data) => setStorage(data));
  }, []);

  if (!storage) {
    return <div className="widget">Loading storage...</div>;
  }

  return (
    <div className="widget">
      <h3>📦 Storage</h3>

      <p>Used: {storage.used} GB</p>
      <p>Free: {storage.free} GB</p>
      <p>Total: {storage.total} GB</p>
    </div>
  );
}

export default WelcomeScreen;
