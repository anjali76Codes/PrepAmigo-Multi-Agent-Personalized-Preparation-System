import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type StylePreset = "default" | "soft" | "outlined" | "crisp";

interface StyleContextType {
  preset: StylePreset;
  setPreset: (preset: StylePreset) => void;
}

const StyleContext = createContext<StyleContextType>({
  preset: "default",
  setPreset: () => {},
});

export function StyleProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<StylePreset>(() => {
    return (localStorage.getItem("prepamigo-style") as StylePreset) || "default";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-style", preset);
    localStorage.setItem("prepamigo-style", preset);
  }, [preset]);

  return (
    <StyleContext.Provider value={{ preset, setPreset }}>
      {children}
    </StyleContext.Provider>
  );
}

export const useStyle = () => useContext(StyleContext);
