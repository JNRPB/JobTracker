import { createContext, useContext } from "react";

const Context = createContext(null);

export const MainProvider = ({ children }) => {
  return (
    <Context.Provider value={{ penis: "bigsacks" }}>
      {children}
    </Context.Provider>
  );
};

export const useMainProvider = () => {
  const context = useContext(Context);
  if (!context) {
    throw new Error("useMyContext must be used within a MyProvider");
  }
  return context;
};

