function SideBarButton({ label, component, navigate }) {
  return (
    <button className="tabButton" onClick={() => navigate(component)}>
      {label}
    </button>
  );
}

export default SideBarButton;
