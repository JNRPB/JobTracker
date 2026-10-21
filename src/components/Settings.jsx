import { useEffect, useMemo, useState } from "react";
import "./Settings.css";
import { HQ_ACCESS_AREAS } from "./access";
import ResourcesSettings from "./ResourcesSettings";

const API_BASE = "";

const DEFAULT_ACCOUNTANT = {
  portalEnabled: true,
  vat: {
    firstPeriodStart: "2026-04-01",
    firstPeriodEnd: "2026-05-31",
    recurringStart: "2026-06-01",
    intervalMonths: 3,
    periodsToShow: 12,
    accountingMethod: "cash",
  },
  supplierRules: [{ supplier: "Callum Mullineaux", excludeFromVat: true }],
};

const EMPTY_USER_FORM = {
  id: null,
  displayName: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "member",
  homeView: "site",
  permissions: ["home"],
  active: true,
};

function dateFromInput(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function periodLabel(start, end) {
  const first = start.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const last = end.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return `${first}–${last}`;
}

function formatAccountDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function settingsMoney(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildPeriods(vat) {
  const periods = [];
  const firstStart = dateFromInput(vat.firstPeriodStart);
  const firstEnd = dateFromInput(vat.firstPeriodEnd);
  const recurringStart = dateFromInput(vat.recurringStart);
  const interval = Math.max(1, Number(vat.intervalMonths || 3));
  const count = Math.max(1, Number(vat.periodsToShow || 12));

  if (firstStart && firstEnd) {
    const start = toInputDate(firstStart);
    const end = toInputDate(firstEnd);
    periods.push({ id: `${start}_${end}`, start, end, label: periodLabel(firstStart, firstEnd) });
  }

  let start = recurringStart;
  while (start && periods.length < count) {
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + interval, 0));
    const startValue = toInputDate(start);
    const endValue = toInputDate(end);
    periods.push({ id: `${startValue}_${endValue}`, start: startValue, end: endValue, label: periodLabel(start, end) });
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + interval, 1));
  }
  return periods;
}

function Settings({
  files = [],
  onDirtyChange,
  currentUser,
  onCurrentUserChange,
  navigate,
}) {
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [passcode, setPasscode] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [hqUsers, setHqUsers] = useState([]);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [showUserForm, setShowUserForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [endpoints, setEndpoints] = useState([]);
  const [endpointFilter, setEndpointFilter] = useState("");
  const [endpointMessage, setEndpointMessage] = useState("");
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [savedNotificationSettings, setSavedNotificationSettings] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [manualNotification, setManualNotification] = useState({
    userIds: [],
    title: "",
    body: "",
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/business-settings`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load settings.");
        return response.json();
      })
      .then((data) => {
        const loadedSettings = {
          ...data,
          pricingDefaults: {
            defaultOverheadPerDay: 0,
            ...(data.pricingDefaults || {}),
          },
          accountant: {
            ...DEFAULT_ACCOUNTANT,
            ...(data.accountant || {}),
            vat: { ...DEFAULT_ACCOUNTANT.vat, ...(data.accountant?.vat || {}) },
            supplierRules: Array.isArray(data.accountant?.supplierRules)
              ? data.accountant.supplierRules
              : DEFAULT_ACCOUNTANT.supplierRules,
          },
        };
        setSettings(loadedSettings);
        setSavedSettings(loadedSettings);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/hq-users`).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load HQ users.");
        return Array.isArray(data.users) ? data.users : [];
      }),
      fetch(`${API_BASE}/api/admin/endpoints`).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load endpoints.");
        return Array.isArray(data.routes) ? data.routes : [];
      }),
      fetch(`${API_BASE}/api/notification-settings`).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load notification settings.");
        return data;
      }),
    ])
      .then(([users, routes, notificationData]) => {
        setHqUsers(users);
        setEndpoints(routes);
        setNotificationSettings(notificationData);
        setSavedNotificationSettings(notificationData);
      })
      .catch((error) => setUserMessage(error.message));
  }, []);

  const periods = useMemo(
    () => buildPeriods(settings?.accountant?.vat || DEFAULT_ACCOUNTANT.vat),
    [settings],
  );

  const dirtySections = useMemo(() => {
    if (!settings || !savedSettings) return {};
    const different = (current, saved) => JSON.stringify(current) !== JSON.stringify(saved);
    return {
      business: different(
        [settings.name, settings.owner, settings.companyNumber, settings.email, settings.phone, settings.website, settings.address1, settings.address2, settings.postcode],
        [savedSettings.name, savedSettings.owner, savedSettings.companyNumber, savedSettings.email, savedSettings.phone, savedSettings.website, savedSettings.address1, savedSettings.address2, savedSettings.postcode],
      ),
      documents: different(
        [settings.vatNumber, settings.defaultVatRate, settings.estimatePrefix, settings.nextEstimateNumber, settings.invoicePrefix, settings.nextInvoiceNumber],
        [savedSettings.vatNumber, savedSettings.defaultVatRate, savedSettings.estimatePrefix, savedSettings.nextEstimateNumber, savedSettings.invoicePrefix, savedSettings.nextInvoiceNumber],
      ),
      pricing: different(
        settings.pricingDefaults,
        savedSettings.pricingDefaults,
      ),
      bank: different(
        [settings.bankDetails, settings.defaultTerms],
        [savedSettings.bankDetails, savedSettings.defaultTerms],
      ),
      vat: different(settings.accountant?.vat, savedSettings.accountant?.vat),
      portal:
        Boolean(passcode) ||
        different(settings.accountant?.portalEnabled, savedSettings.accountant?.portalEnabled),
      suppliers: different(
        settings.accountant?.supplierRules,
        savedSettings.accountant?.supplierRules,
      ),
      notifications:
        notificationSettings && savedNotificationSettings
          ? different(
              notificationSettings.templates,
              savedNotificationSettings.templates,
            )
          : false,
    };
  }, [settings, savedSettings, passcode, notificationSettings, savedNotificationSettings]);

  const isDirty = Object.values(dirtySections).some(Boolean);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    function warnBeforeUnload(event) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const supplierOptions = useMemo(() => {
    const excluded = new Set(
      (settings?.accountant?.supplierRules || []).map((rule) =>
        String(rule.supplier || "").trim().toLowerCase(),
      ),
    );

    return [...new Set(
      files
        .map((file) => String(file.supplier || "").trim())
        .filter(Boolean),
    )]
      .filter((supplier) => !excluded.has(supplier.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [files, settings?.accountant?.supplierRules]);

  const periodPublication = useMemo(() => {
    const excludedVatSuppliers = new Set(
      (settings?.accountant?.supplierRules || [])
        .filter((rule) => rule.excludeFromVat === true)
        .map((rule) => String(rule.supplier || "").trim().toLowerCase()),
    );
    const counts = Object.fromEntries(
      periods.map((period) => [
        period.id,
        files.filter((file) => {
          const date = String(file.purchaseDate || "").slice(0, 10);
          const supplier = String(file.supplier || "").trim().toLowerCase();
          return date >= period.start && date <= period.end && !excludedVatSuppliers.has(supplier);
        }).length,
      ]),
    );
    const configured = settings?.accountant?.vat?.publishedPeriodIds;
    const today = new Date().toISOString().slice(0, 10);
    const publishedIds = Array.isArray(configured)
      ? configured
      : periods
          .filter((period) => period.end < today && Number(counts[period.id] || 0) > 0)
          .map((period) => period.id);
    return { counts, publishedIds };
  }, [files, periods, settings?.accountant?.supplierRules, settings?.accountant?.vat?.publishedPeriodIds]);

  const endpointGroups = useMemo(() => {
    const query = endpointFilter.trim().toLowerCase();
    return endpoints.reduce((groups, endpoint) => {
      const matches =
        !query ||
        `${endpoint.method} ${endpoint.path} ${endpoint.category}`
          .toLowerCase()
          .includes(query);
      if (!matches) return groups;
      const category = endpoint.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(endpoint);
      return groups;
    }, {});
  }, [endpoints, endpointFilter]);

  function updateAccountant(patch) {
    setSettings((current) => ({
      ...current,
      accountant: { ...current.accountant, ...patch },
    }));
  }

  function updateSetting(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function updateBank(field, value) {
    setSettings((current) => ({
      ...current,
      bankDetails: { ...(current.bankDetails || {}), [field]: value },
    }));
  }

  function updatePricingDefault(field, value) {
    setSettings((current) => ({
      ...current,
      pricingDefaults: {
        ...(current.pricingDefaults || {}),
        [field]: value,
      },
    }));
  }

  function updateVat(field, value) {
    updateAccountant({ vat: { ...settings.accountant.vat, [field]: value } });
  }

  function togglePeriodPublished(periodId) {
    const current = new Set(periodPublication.publishedIds);
    if (current.has(periodId)) current.delete(periodId);
    else current.add(periodId);
    updateVat("publishedPeriodIds", [...current]);
  }

  function addSupplierRule(event) {
    event.preventDefault();
    const supplier = selectedSupplier.trim();
    if (!supplier) return;
    const exists = settings.accountant.supplierRules.some(
      (rule) => rule.supplier.trim().toLowerCase() === supplier.toLowerCase(),
    );
    if (exists) {
      setMessage("That supplier already has a rule.");
      return;
    }
    updateAccountant({
      supplierRules: [
        ...settings.accountant.supplierRules,
        { supplier, excludeFromVat: true },
      ],
    });
    setSelectedSupplier("");
    setMessage("");
  }

  function removeSupplierRule(index) {
    updateAccountant({
      supplierRules: settings.accountant.supplierRules.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function updateSupplierRule(index, field, checked) {
    updateAccountant({
      supplierRules: settings.accountant.supplierRules.map((rule, itemIndex) =>
        itemIndex === index ? { ...rule, [field]: checked } : rule,
      ),
    });
  }

  function beginAddUser() {
    setUserForm(EMPTY_USER_FORM);
    setShowUserForm(true);
    setUserMessage("");
  }

  function beginEditUser(user) {
    setUserForm({
      id: user.id,
      displayName: user.displayName || "",
      username: user.username || "",
      password: "",
      confirmPassword: "",
      role: user.role === "admin" ? "admin" : "member",
      homeView: user.role === "admin" ? "standard" : user.homeView || "standard",
      permissions:
        user.role === "admin"
          ? HQ_ACCESS_AREAS.map((area) => area.id)
          : Array.isArray(user.permissions)
            ? user.permissions
            : [],
      active: user.active !== false,
    });
    setShowUserForm(true);
    setUserMessage("");
  }

  function updateUserForm(field, value) {
    setUserForm((current) => ({ ...current, [field]: value }));
  }

  function toggleUserPermission(permission) {
    setUserForm((current) => {
      const permissions = new Set(current.permissions || []);
      if (permissions.has(permission)) permissions.delete(permission);
      else permissions.add(permission);
      return { ...current, permissions: [...permissions] };
    });
  }

  async function saveHqUser(event) {
    event.preventDefault();
    if (userForm.password !== userForm.confirmPassword) {
      setUserMessage("The two passwords do not match.");
      return;
    }
    if (!userForm.id && userForm.password.length < 8) {
      setUserMessage("New accounts need a password of at least 8 characters.");
      return;
    }

    setSavingUser(true);
    setUserMessage(userForm.id ? "Saving account…" : "Creating account…");

    try {
      const response = await fetch(
        userForm.id
          ? `${API_BASE}/api/hq-users/${encodeURIComponent(userForm.id)}`
          : `${API_BASE}/api/hq-users`,
        {
          method: userForm.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: userForm.displayName,
            username: userForm.username,
            role: userForm.role,
            homeView: userForm.role === "admin" ? "standard" : userForm.homeView,
            permissions: userForm.permissions,
            active: userForm.active,
            ...(userForm.password ? { password: userForm.password } : {}),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save this account.");

      setHqUsers((current) => {
        const exists = current.some((user) => String(user.id) === String(data.user.id));
        const next = exists
          ? current.map((user) =>
              String(user.id) === String(data.user.id) ? data.user : user,
            )
          : [...current, data.user];
        return next.sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.displayName.localeCompare(b.displayName);
        });
      });
      setNotificationSettings((current) => {
        if (!current) return current;
        const previous = (current.users || []).find(
          (user) => String(user.id) === String(data.user.id),
        );
        const nextUser = {
          id: String(data.user.id),
          displayName: data.user.displayName,
          username: data.user.username,
          role: data.user.role,
          deviceCount: previous?.deviceCount || 0,
        };
        const exists = (current.users || []).some(
          (user) => String(user.id) === String(data.user.id),
        );
        return {
          ...current,
          users: (exists
            ? current.users.map((user) =>
                String(user.id) === String(data.user.id) ? nextUser : user,
              )
            : [...(current.users || []), nextUser]
          ).sort((a, b) => a.displayName.localeCompare(b.displayName)),
        };
      });
      if (data.currentUser) onCurrentUserChange?.(data.currentUser);
      setShowUserForm(false);
      setUserForm(EMPTY_USER_FORM);
      setUserMessage(
        userForm.id
          ? "Account updated. Access changes take effect immediately."
          : "Account created. They can sign in now.",
      );
    } catch (error) {
      setUserMessage(error.message);
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteHqUser(user) {
    const confirmed = window.confirm(
      `Delete ${user.displayName}'s HQ login? This does not delete any jobs or files.`,
    );
    if (!confirmed) return;

    setUserMessage(`Deleting ${user.displayName}'s account…`);
    try {
      const response = await fetch(
        `${API_BASE}/api/hq-users/${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete this account.");
      setHqUsers((current) =>
        current.filter((item) => String(item.id) !== String(user.id)),
      );
      setNotificationSettings((current) =>
        current
          ? {
              ...current,
              users: (current.users || []).filter(
                (item) => String(item.id) !== String(user.id),
              ),
            }
          : current,
      );
      setManualNotification((current) => ({
        ...current,
        userIds: current.userIds.filter(
          (userId) => String(userId) !== String(user.id),
        ),
      }));
      if (String(userForm.id) === String(user.id)) {
        setShowUserForm(false);
        setUserForm(EMPTY_USER_FORM);
      }
      setUserMessage("Account deleted. Existing sessions for it are no longer valid.");
    } catch (error) {
      setUserMessage(error.message);
    }
  }

  function renderNotificationPreview(value) {
    const sample = notificationSettings?.sample || {};
    return String(value || "")
      .replace(/\{([a-z_]+)\}/gi, (match, name) => sample[name] || match)
      .replace(/\s+([.,!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function updateNotificationTemplate(key, field, value) {
    setNotificationSettings((current) =>
      current
        ? {
            ...current,
            templates: (current.templates || []).map((template) =>
              template.key === key ? { ...template, [field]: value } : template,
            ),
          }
        : current,
    );
    setNotificationMessage("");
  }

  function toggleManualRecipient(userId) {
    const resolvedId = String(userId);
    setManualNotification((current) => ({
      ...current,
      userIds: current.userIds.includes(resolvedId)
        ? current.userIds.filter((item) => item !== resolvedId)
        : [...current.userIds, resolvedId],
    }));
  }

  async function sendTestNotification(user) {
    setSendingNotification(true);
    setNotificationMessage(`Sending a test to ${user.displayName}…`);
    try {
      const response = await fetch(`${API_BASE}/api/notifications/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not send the test.");
      setNotificationMessage(
        `Test sent to ${user.displayName}'s HQ inbox${
          Number(user.deviceCount || 0) > 0 ? " and enabled devices" : ""
        }.`,
      );
    } catch (error) {
      setNotificationMessage(error.message);
    } finally {
      setSendingNotification(false);
    }
  }

  async function sendManualNotification(event) {
    event.preventDefault();
    setSendingNotification(true);
    setNotificationMessage("Sending team message…");
    try {
      const response = await fetch(`${API_BASE}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualNotification),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not send the message.");
      setNotificationMessage(
        `Message sent to ${data.queued} ${data.queued === 1 ? "person" : "people"}.`,
      );
      setManualNotification((current) => ({ ...current, title: "", body: "" }));
    } catch (error) {
      setNotificationMessage(error.message);
    } finally {
      setSendingNotification(false);
    }
  }

  async function copyEndpointPath(endpoint) {
    const value = `${window.location.origin}${endpoint.path}`;
    try {
      await navigator.clipboard.writeText(value);
      setEndpointMessage(`Copied ${endpoint.method} ${endpoint.path}`);
    } catch {
      setEndpointMessage("Your browser blocked clipboard access.");
    }
  }

  async function copyEndpointJson(endpoint) {
    setEndpointMessage(`Loading ${endpoint.path}…`);
    try {
      const response = await fetch(`${API_BASE}${endpoint.path}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || data === null) {
        throw new Error("This endpoint did not return readable JSON.");
      }
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setEndpointMessage(`Copied JSON from ${endpoint.path}`);
    } catch (error) {
      setEndpointMessage(error.message || "Could not copy endpoint JSON.");
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("Saving settings…");
    try {
      const payload = {
        ...settings,
        accountant: {
          ...settings.accountant,
          ...(passcode ? { passcode } : {}),
        },
      };
      const response = await fetch(`${API_BASE}/api/business-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save settings.");
      let savedNotifications = notificationSettings;
      if (notificationSettings) {
        const notificationResponse = await fetch(`${API_BASE}/api/notification-settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templates: notificationSettings.templates }),
        });
        const notificationData = await notificationResponse.json().catch(() => ({}));
        if (!notificationResponse.ok) {
          throw new Error(
            notificationData.error || "Business settings saved, but notification messages could not be saved.",
          );
        }
        savedNotifications = notificationData.settings;
      }
      setSettings(data.settings);
      setSavedSettings(data.settings);
      if (savedNotifications) {
        setNotificationSettings(savedNotifications);
        setSavedNotificationSettings(savedNotifications);
      }
      setPasscode("");
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function restartServer() {
    const confirmed = window.confirm(
      "Restart the JNR HQ server now? HQ will be unavailable briefly.",
    );
    if (!confirmed) return;

    setRestarting(true);
    setMessage("Restarting JNR HQ…");
    try {
      const response = await fetch(`${API_BASE}/api/restart-server`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not restart the server.");
      setMessage("Restart command sent. Reconnecting…");
      window.setTimeout(() => window.location.reload(), 5000);
    } catch (error) {
      setRestarting(false);
      setMessage(error.message);
    }
  }

  if (!settings) {
    return <section className="settingsPage"><p>{message || "Loading settings…"}</p></section>;
  }

  return (
    <section className={`settingsPage ${isDirty ? "isDirty" : ""}`}>
      <header className="settingsHeader">
        <div><p className="settingsEyebrow">JNR HQ</p><h2>Settings</h2><p>Manage your team access, company, documents, VAT and accountant portal.</p></div>
        <div className="settingsSaveArea">{isDirty && <span className="settingsUnsaved">Unsaved changes</span>}<button className="settingsSave" type="button" onClick={saveSettings} disabled={saving || !isDirty}>{saving ? "Saving…" : "Save settings"}</button></div>
      </header>

      {message && <div className="settingsMessage">{message}</div>}

      <div className="settingsGrid">
        <article className="settingsCard full settingsAccessCard">
          <div className="settingsCardTitle">
            <div>
              <h3>HQ users</h3>
              <p>
                Give each person their own login and choose which parts of JNR HQ
                appear for them. You remain the protected administrator.
              </p>
            </div>
            <button
              className="settingsPrimaryAction"
              type="button"
              onClick={beginAddUser}
            >
              + Add HQ user
            </button>
          </div>

          {userMessage && <div className="settingsInlineMessage">{userMessage}</div>}

          {showUserForm && (
            <form className="hqUserEditor" onSubmit={saveHqUser}>
              <div className="hqUserEditorHeading">
                <div>
                  <span>{userForm.id ? "Edit account" : "New account"}</span>
                  <strong>
                    {userForm.id
                      ? userForm.displayName || userForm.username
                      : "Create a private JNR HQ login"}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserForm(false);
                    setUserForm(EMPTY_USER_FORM);
                    setUserMessage("");
                  }}
                >
                  Cancel
                </button>
              </div>

              <div className="settingsFields two">
                <label>
                  Display name
                  <input
                    value={userForm.displayName}
                    onChange={(event) => updateUserForm("displayName", event.target.value)}
                    placeholder="e.g. Callum"
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={userForm.username}
                    onChange={(event) => updateUserForm("username", event.target.value)}
                    placeholder="e.g. callum"
                    autoComplete="off"
                    required
                  />
                </label>
                <label>
                  {userForm.id ? "New password" : "Password"}
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(event) => updateUserForm("password", event.target.value)}
                    placeholder={
                      userForm.id
                        ? "Leave blank to keep their current password"
                        : "At least 8 characters"
                    }
                    autoComplete="new-password"
                    required={!userForm.id}
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    type="password"
                    value={userForm.confirmPassword}
                    onChange={(event) =>
                      updateUserForm("confirmPassword", event.target.value)
                    }
                    placeholder="Type the new password again"
                    autoComplete="new-password"
                    required={Boolean(userForm.password)}
                  />
                </label>
                <label>
                  Account type
                  <select
                    value={userForm.role}
                    onChange={(event) => {
                      const role = event.target.value;
                      setUserForm((current) => ({
                        ...current,
                        role,
                        homeView: role === "admin" ? "standard" : current.homeView,
                      }));
                    }}
                  >
                    <option value="member">Team member — selected access</option>
                    <option value="admin">Administrator — full access</option>
                  </select>
                </label>
                <label>
                  Landing page
                  <select
                    value={userForm.role === "admin" ? "standard" : userForm.homeView}
                    disabled={userForm.role === "admin"}
                    onChange={(event) => updateUserForm("homeView", event.target.value)}
                  >
                    <option value="site">My Work — assigned sites only</option>
                    <option value="standard">Standard HQ dashboard</option>
                  </select>
                  <small>
                    My Work keeps financials and admin pages out of the site view.
                  </small>
                </label>
                <label className="hqUserActiveToggle">
                  <input
                    type="checkbox"
                    checked={userForm.active}
                    onChange={(event) => updateUserForm("active", event.target.checked)}
                  />
                  <span>
                    <strong>Login enabled</strong>
                    <small>Turn this off to block their account immediately.</small>
                  </span>
                </label>
              </div>

              <fieldset className="hqPermissionFieldset">
                <legend>What can this person see?</legend>
                <div className="hqPermissionGrid">
                  {HQ_ACCESS_AREAS.map((area) => {
                    const checked =
                      userForm.role === "admin" ||
                      userForm.permissions.includes(area.id);
                    return (
                      <label
                        className={`hqPermissionOption ${checked ? "selected" : ""}`}
                        key={area.id}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={userForm.role === "admin"}
                          onChange={() => toggleUserPermission(area.id)}
                        />
                        <span>
                          <strong>{area.label}</strong>
                          <small>{area.description}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {userForm.role === "admin" && (
                  <p>Administrators always have access to every section and Settings.</p>
                )}
              </fieldset>

              <div className="hqUserEditorActions">
                <span>
                  Account changes save separately and take effect immediately.
                </span>
                <button type="submit" disabled={savingUser}>
                  {savingUser
                    ? "Saving…"
                    : userForm.id
                      ? "Save account"
                      : "Create account"}
                </button>
              </div>
            </form>
          )}

          <div className="hqUserList">
            {hqUsers.map((user) => {
              const isCurrent = String(user.id) === String(currentUser?.id);
              const accessLabels =
                user.role === "admin"
                  ? ["Full HQ access"]
                  : HQ_ACCESS_AREAS.filter((area) =>
                      user.permissions?.includes(area.id),
                    ).map((area) => area.label);
              return (
                <article
                  className={`hqUserCard ${user.active ? "" : "disabled"}`}
                  key={user.id}
                >
                  <div className="hqUserAvatar" aria-hidden="true">
                    {(user.displayName || user.username || "U")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="hqUserIdentity">
                    <div>
                      <strong>{user.displayName}</strong>
                      {isCurrent && <span className="hqUserYou">You</span>}
                      {!user.active && <span className="hqUserDisabled">Disabled</span>}
                    </div>
                    <span>@{user.username}</span>
                    <small>Last login: {formatAccountDate(user.lastLoginAt)}</small>
                  </div>
                  <div className="hqUserAccess">
                    <span>{user.role === "admin" ? "Administrator" : user.homeView === "site" ? "Site · My Work" : "Team member"}</span>
                    <p>{accessLabels.length ? accessLabels.join(" · ") : "No page access"}</p>
                  </div>
                  <div className="hqUserActions">
                    <button type="button" onClick={() => beginEditUser(user)}>
                      Edit / reset password
                    </button>
                    {!isCurrent && (
                      <button
                        className="danger"
                        type="button"
                        onClick={() => deleteHqUser(user)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        {notificationSettings && (
          <article
            className={`settingsCard full notificationSettingsCard ${
              dirtySections.notifications ? "dirty" : ""
            }`}
          >
            <div className="settingsCardTitle notificationSettingsTitle">
              <div>
                <h3>Team notifications</h3>
                <p>
                  Callum, Max and future team members receive these in their HQ
                  inbox. They can also enable free phone notifications from the
                  bell in the top bar.
                </p>
              </div>
              <span
                className={`notificationAvailability ${
                  notificationSettings.available ? "ready" : "inboxOnly"
                }`}
              >
                {notificationSettings.available
                  ? "● Free Web Push ready"
                  : "Inbox active · phone push unavailable"}
              </span>
            </div>

            {notificationMessage && (
              <div className="settingsInlineMessage notificationSettingsMessage">
                {notificationMessage}
              </div>
            )}

            <div className="notificationSettingsOverview">
              <section className="notificationPeoplePanel">
                <div className="notificationSectionHeading">
                  <div>
                    <span>Delivery</span>
                    <strong>JNR people</strong>
                  </div>
                  <small>One tap on the bell enables each device.</small>
                </div>
                <div className="notificationPeopleList">
                  {(notificationSettings.users || []).map((user) => (
                    <div className="notificationPerson" key={user.id}>
                      <span className="notificationPersonAvatar">
                        {(user.displayName || user.username || "U")
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span className="notificationPersonIdentity">
                        <strong>{user.displayName}</strong>
                        <small>
                          @{user.username} · {user.role === "admin" ? "Admin" : "Team"}
                        </small>
                      </span>
                      <span
                        className={`notificationDeviceState ${
                          user.deviceCount ? "ready" : "waiting"
                        }`}
                      >
                        {user.deviceCount
                          ? `${user.deviceCount} ${user.deviceCount === 1 ? "device" : "devices"}`
                          : "Inbox only"}
                      </span>
                      <button
                        type="button"
                        onClick={() => sendTestNotification(user)}
                        disabled={sendingNotification}
                      >
                        Send test
                      </button>
                    </div>
                  ))}
                </div>
                <p className="notificationDeliveryNote">
                  To enable a phone: sign in as that person on their device, open
                  the bell, then press <strong>Enable</strong>. No paid messaging
                  service is used.
                </p>
              </section>

              <form className="notificationComposer" onSubmit={sendManualNotification}>
                <div className="notificationSectionHeading">
                  <div>
                    <span>Send now</span>
                    <strong>Team message</strong>
                  </div>
                  <small>Useful for one-off site updates.</small>
                </div>
                <fieldset>
                  <legend>Send to</legend>
                  <div className="notificationRecipientChoices">
                    {(notificationSettings.users || []).map((user) => {
                      const selected = manualNotification.userIds.includes(String(user.id));
                      return (
                        <label className={selected ? "selected" : ""} key={user.id}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleManualRecipient(user.id)}
                          />
                          <span>{user.displayName}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <label>
                  Title
                  <input
                    value={manualNotification.title}
                    onChange={(event) =>
                      setManualNotification((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    maxLength="120"
                    placeholder="Tomorrow's site update"
                  />
                </label>
                <label>
                  Message
                  <textarea
                    value={manualNotification.body}
                    onChange={(event) =>
                      setManualNotification((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    maxLength="500"
                    rows="3"
                    placeholder="Write the message Callum or Max should receive…"
                  />
                </label>
                <button
                  className="notificationSendButton"
                  type="submit"
                  disabled={
                    sendingNotification ||
                    !manualNotification.userIds.length ||
                    !manualNotification.title.trim() ||
                    !manualNotification.body.trim()
                  }
                >
                  {sendingNotification ? "Sending…" : "Send notification"}
                </button>
              </form>
            </div>

            <div className="notificationTemplateHeader">
              <div>
                <span>Automatic messages</span>
                <strong>Choose exactly what HQ says</strong>
              </div>
              <div className="notificationVariableLegend">
                {(notificationSettings.variables || []).map((variable) => (
                  <code key={variable}>{variable}</code>
                ))}
              </div>
            </div>

            <div className="notificationTemplateList">
              {(notificationSettings.templates || []).map((template, index) => (
                <details
                  className={`notificationTemplate ${template.enabled ? "enabled" : "disabled"}`}
                  key={template.key}
                  defaultOpen={index === 0}
                >
                  <summary>
                    <span className="notificationTemplateSignal" />
                    <span>
                      <strong>{template.label}</strong>
                      <small>{template.description}</small>
                    </span>
                    <em>{template.enabled ? "On" : "Off"}</em>
                  </summary>
                  <div className="notificationTemplateEditor">
                    <label className="notificationTemplateToggle">
                      <input
                        type="checkbox"
                        checked={template.enabled}
                        onChange={(event) =>
                          updateNotificationTemplate(
                            template.key,
                            "enabled",
                            event.target.checked,
                          )
                        }
                      />
                      <span>
                        <strong>Send this notification</strong>
                        <small>Turn it off without deleting your wording.</small>
                      </span>
                    </label>
                    <div className="notificationTemplateFields">
                      <label>
                        Notification title
                        <input
                          value={template.title}
                          maxLength="120"
                          onChange={(event) =>
                            updateNotificationTemplate(
                              template.key,
                              "title",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Message
                        <textarea
                          value={template.body}
                          maxLength="500"
                          rows="3"
                          onChange={(event) =>
                            updateNotificationTemplate(
                              template.key,
                              "body",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                    <div className="notificationPreview">
                      <span>Live preview</span>
                      <strong>{renderNotificationPreview(template.title)}</strong>
                      <p>{renderNotificationPreview(template.body)}</p>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </article>
        )}

        <ResourcesSettings navigate={navigate} />

        <article className={`settingsCard full ${dirtySections.business ? "dirty" : ""}`}>
          <div className="settingsCardTitle"><div><h3>Business details</h3><p>Used across HQ, estimates, invoices and the accountant portal.</p></div></div>
          <div className="settingsFields three">
            <label>Business name<input value={settings.name || ""} onChange={(event) => updateSetting("name", event.target.value)} /></label>
            <label>Owner<input value={settings.owner || ""} onChange={(event) => updateSetting("owner", event.target.value)} /></label>
            <label>Company number<input value={settings.companyNumber || ""} onChange={(event) => updateSetting("companyNumber", event.target.value)} placeholder="Optional" /></label>
            <label>Email<input type="email" value={settings.email || ""} onChange={(event) => updateSetting("email", event.target.value)} /></label>
            <label>Phone<input value={settings.phone || ""} onChange={(event) => updateSetting("phone", event.target.value)} /></label>
            <label>Website<input value={settings.website || ""} onChange={(event) => updateSetting("website", event.target.value)} /></label>
            <label>Address line 1<input value={settings.address1 || ""} onChange={(event) => updateSetting("address1", event.target.value)} /></label>
            <label>Address line 2<input value={settings.address2 || ""} onChange={(event) => updateSetting("address2", event.target.value)} /></label>
            <label>Postcode<input value={settings.postcode || ""} onChange={(event) => updateSetting("postcode", event.target.value)} /></label>
          </div>
        </article>

        <article className={`settingsCard ${dirtySections.documents ? "dirty" : ""}`}>
          <div className="settingsCardTitle"><div><h3>Document settings</h3><p>Controls VAT defaults and the next generated numbers.</p></div></div>
          <div className="settingsFields two">
            <label>VAT number<input value={settings.vatNumber || ""} onChange={(event) => updateSetting("vatNumber", event.target.value)} /></label>
            <label>Default VAT rate<input type="number" min="0" max="100" step="0.1" value={settings.defaultVatRate ?? 20} onChange={(event) => updateSetting("defaultVatRate", Number(event.target.value))} /></label>
            <label>Estimate prefix<input value={settings.estimatePrefix || ""} onChange={(event) => updateSetting("estimatePrefix", event.target.value)} /></label>
            <label>Next estimate number<input type="number" min="1" value={settings.nextEstimateNumber ?? 1} onChange={(event) => updateSetting("nextEstimateNumber", Number(event.target.value))} /></label>
            <label>Invoice prefix<input value={settings.invoicePrefix || ""} onChange={(event) => updateSetting("invoicePrefix", event.target.value)} /></label>
            <label>Next invoice number<input type="number" min="1" value={settings.nextInvoiceNumber ?? 1} onChange={(event) => updateSetting("nextInvoiceNumber", Number(event.target.value))} /></label>
          </div>
        </article>

        <article className={`settingsCard settingsPricingCard ${dirtySections.pricing ? "dirty" : ""}`}>
          <div className="settingsCardTitle">
            <div>
              <h3>Pricing defaults</h3>
              <p>Internal costs used when Pricing Notes becomes an estimate.</p>
            </div>
            <span className="settingsInternalBadge">Internal only</span>
          </div>
          <div className="settingsPricingDefault">
            <label>
              Default overhead per working day
              <div className="settingsMoneyField">
                <span>£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.pricingDefaults?.defaultOverheadPerDay ?? 0}
                  onChange={(event) =>
                    updatePricingDefault(
                      "defaultOverheadPerDay",
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                />
              </div>
            </label>
            <p className="settingsPricingHelp">
              Your allowance for the van, fuel not allocated elsewhere, insurance, software, tools, admin and other running costs. It is only added when you choose to include it during estimate conversion.
            </p>
            <div className="settingsOverheadExamples" aria-label="Overhead examples">
              {[1, 5, 10].map((days) => (
                <span key={days}>
                  <b>{days} {days === 1 ? "day" : "days"}</b>
                  {settingsMoney(Number(settings.pricingDefaults?.defaultOverheadPerDay || 0) * days)}
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className={`settingsCard ${dirtySections.bank ? "dirty" : ""}`}>
          <div className="settingsCardTitle"><div><h3>Bank and payment details</h3><p>Shown on customer payment documents.</p></div></div>
          <div className="settingsFields">
            <label>Account name<input value={settings.bankDetails?.accountName || ""} onChange={(event) => updateBank("accountName", event.target.value)} /></label>
            <label>Sort code<input value={settings.bankDetails?.sortCode || ""} onChange={(event) => updateBank("sortCode", event.target.value)} /></label>
            <label>Account number<input value={settings.bankDetails?.accountNumber || ""} onChange={(event) => updateBank("accountNumber", event.target.value)} /></label>
            <label>Default terms<textarea rows="3" value={settings.defaultTerms || ""} onChange={(event) => updateSetting("defaultTerms", event.target.value)} placeholder="Optional default payment terms" /></label>
          </div>
        </article>

        <article className={`settingsCard ${dirtySections.vat ? "dirty" : ""}`}>
          <div className="settingsCardTitle"><div><h3>VAT periods</h3><p>Your first return is shorter, then periods repeat every three months.</p></div></div>
          <label className="settingsWideLabel">VAT accounting method
            <select value={settings.accountant.vat.accountingMethod || "cash"} onChange={(event) => updateVat("accountingMethod", event.target.value)}>
              <option value="unconfirmed">Not confirmed yet — review each sales invoice</option>
              <option value="invoice">Standard VAT accounting — use invoice / tax-point date</option>
              <option value="cash">VAT Cash Accounting Scheme — use payment date</option>
            </select>
          </label>
          <div className="settingsFields three">
            <label>First period starts<input type="date" value={settings.accountant.vat.firstPeriodStart} onChange={(event) => updateVat("firstPeriodStart", event.target.value)} /></label>
            <label>First period ends<input type="date" value={settings.accountant.vat.firstPeriodEnd} onChange={(event) => updateVat("firstPeriodEnd", event.target.value)} /></label>
            <label>Recurring periods start<input type="date" value={settings.accountant.vat.recurringStart} onChange={(event) => updateVat("recurringStart", event.target.value)} /></label>
          </div>
          <div className="periodPreview">
            {periods.map((period) => { const published = periodPublication.publishedIds.includes(period.id); return <div className={`periodPreviewItem ${published ? "published" : "hidden"}`} key={period.id}><div><strong>{period.label}</strong><span>{period.start} to {period.end} · {periodPublication.counts[period.id] || 0} files</span></div><button type="button" onClick={() => togglePeriodPublished(period.id)}>{published ? "Hide" : "Publish"}</button></div>; })}
          </div>
        </article>

        <article className={`settingsCard ${dirtySections.portal ? "dirty" : ""}`}>
          <div className="settingsCardTitle"><div><h3>Accountant portal</h3><p>Read-only access to documents included in each VAT period.</p></div><div className="portalActions"><a className="openPortalLink" href="/accountant" target="_blank" rel="noreferrer">Open portal ↗</a><label className="settingsToggle"><input type="checkbox" checked={settings.accountant.portalEnabled !== false} onChange={(event) => updateAccountant({ portalEnabled: event.target.checked })} /><span>{settings.accountant.portalEnabled !== false ? "Enabled" : "Disabled"}</span></label></div></div>
          <div className={`passcodeStatus ${settings.accountant.passcodeConfigured ? "set" : "missing"}`}><strong>{settings.accountant.passcodeConfigured ? "Portal passcode is set" : "No portal passcode is set"}</strong><span>{settings.accountant.passcodeSource === "settings" ? "Managed from this Settings page" : settings.accountant.passcodeSource === "environment" ? "Currently using the server .env passcode" : "Set one below before sharing the portal"}</span></div>
          <label className="settingsWideLabel">Set a new portal passcode<input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder="Leave blank to keep the current passcode" autoComplete="new-password" /></label>
        </article>

        <article className={`settingsCard full ${dirtySections.suppliers ? "dirty" : ""}`}>
          <div className="settingsCardTitle"><div><h3>Supplier exclusions</h3><p>Choose exactly where each saved supplier should be excluded. Normal job costing is unaffected.</p></div></div>
          <form className="supplierRuleForm" onSubmit={addSupplierRule}><select value={selectedSupplier} onChange={(event) => setSelectedSupplier(event.target.value)} disabled={!supplierOptions.length}><option value="">{supplierOptions.length ? "Choose a supplier…" : "No other saved suppliers available"}</option>{supplierOptions.map((supplier) => <option value={supplier} key={supplier}>{supplier}</option>)}</select><button type="submit" disabled={!selectedSupplier}>Add supplier rule</button></form>
          <div className="supplierRules">
            {settings.accountant.supplierRules.map((rule, index) => <div className="supplierRule" key={`${rule.supplier}-${index}`}><strong>{rule.supplier}</strong><div className="supplierRuleChecks"><label><input type="checkbox" checked={rule.excludeFromVat === true} onChange={(event) => updateSupplierRule(index, "excludeFromVat", event.target.checked)} /> VAT pack</label><label><input type="checkbox" checked={rule.excludeFromTaxReturn === true} onChange={(event) => updateSupplierRule(index, "excludeFromTaxReturn", event.target.checked)} /> Year-end / tax pack</label><label><input type="checkbox" checked={rule.excludeFromCis === true} onChange={(event) => updateSupplierRule(index, "excludeFromCis", event.target.checked)} /> CIS</label></div><button type="button" onClick={() => removeSupplierRule(index)}>Remove</button></div>)}
            {!settings.accountant.supplierRules.length && <p className="settingsEmpty">No suppliers are excluded.</p>}
          </div>
        </article>

        <article className="settingsCard full settingsEndpointCard">
          <div className="settingsCardTitle">
            <div>
              <h3>Data &amp; API directory</h3>
              <p>
                Every endpoint currently registered by the JNR HQ server. Safe
                read-only JSON routes can be opened or copied; action routes are
                listed for reference only.
              </p>
            </div>
            <strong className="endpointCount">{endpoints.length} endpoints</strong>
          </div>

          <div className="endpointToolbar">
            <input
              value={endpointFilter}
              onChange={(event) => setEndpointFilter(event.target.value)}
              placeholder="Search endpoints — try jobs, files, VAT…"
            />
            {endpointMessage && <span>{endpointMessage}</span>}
          </div>

          <div className="endpointGroups">
            {Object.entries(endpointGroups).map(([category, routes]) => (
              <details className="endpointGroup" key={category} open={category === "Jobs"}>
                <summary>
                  <strong>{category}</strong>
                  <span>{routes.length}</span>
                </summary>
                <div className="endpointRows">
                  {routes.map((endpoint, index) => (
                    <div
                      className="endpointRow"
                      key={`${endpoint.method}-${endpoint.path}-${index}`}
                    >
                      <span className={`endpointMethod ${endpoint.method.toLowerCase()}`}>
                        {endpoint.method}
                      </span>
                      <code>{endpoint.path}</code>
                      <div className="endpointActions">
                        <button type="button" onClick={() => copyEndpointPath(endpoint)}>
                          Copy URL
                        </button>
                        {endpoint.safeJson && !endpoint.parameterised && (
                          <>
                            <a href={endpoint.path} target="_blank" rel="noreferrer">
                              Open JSON ↗
                            </a>
                            <button
                              type="button"
                              onClick={() => copyEndpointJson(endpoint)}
                            >
                              Copy JSON
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            {!Object.keys(endpointGroups).length && (
              <p className="settingsEmpty">No endpoints match that search.</p>
            )}
          </div>
        </article>

        <article className="settingsCard full settingsSystemCard">
          <div className="settingsCardTitle"><div><h3>JNR HQ server</h3><p>{isDirty ? "Save your Settings changes before restarting the server." : "Restart the Job Tracker process after server-side changes."}</p></div><button className="settingsRestart" type="button" onClick={restartServer} disabled={restarting || isDirty}>{restarting ? "Restarting…" : "Restart JNR HQ server"}</button></div>
        </article>
      </div>
    </section>
  );
}

export default Settings;
