function SideBarButton({ label, component, setActiveComponent }) {
  return (
    <button className="tabButton" onClick={() => setActiveComponent(component)}>
      {label}
    </button>
  );
}

export default SideBarButton;
