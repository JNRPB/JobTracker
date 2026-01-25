function SideBarButton({ label, component, setActiveComponent }) {
  return (
    <button
      style={{ backgroundColor: "#2e1e1e" }}
      onClick={() => setActiveComponent(component)}
    >
      {label}
    </button>
  );
}

export default SideBarButton;
