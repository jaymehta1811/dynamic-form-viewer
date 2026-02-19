import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { CircleUser, Image, ChevronDown, Check } from "lucide-react";
import "./Form.css";
import {
  fetchIndiaCities,
  fetchIndiaStates,
  fetchPincodesByDistrict,
} from "../services/locationService";
import { addProfile, cancelEdit, updateProfile } from "../store/profilesSlice";

const COUNTRY_OPTIONS = ["India", "Non-Indian Resident"];

const required = (value) => value && value.toString().trim().length > 0;
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");

const buildInitialValues = () => ({
  username: "",
  about: "",
  firstName: "",
  lastName: "",
  email: "",
  country: "India", // Default to India
  streetAddress: "", // Used for both Street Address (India) and full Address (Non-India)
  state: "",
  district: "",
  postalCode: "",
  avatarDataUrl: "",
  notifications: {
    comments: true,
    candidates: false,
    offers: false,
  },
  pushNotifications: "everything",
});

export default function Form() {
  const fileInputRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const editingId = useSelector((s) => s.profiles.editingId);
  const editingProfile = useSelector((s) =>
    editingId ? s.profiles.items.find((p) => p.id === editingId) : null,
  );
  const [values, setValues] = useState(buildInitialValues);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // UI States
  const [stateOpen, setStateOpen] = useState(false);

  // --- DYNAMIC DATA LISTS ---
  const [statesList, setStatesList] = useState([]);      // Array of state objects/strings
  const [districtsList, setDistrictsList] = useState([]); // Array of city strings
  const [pincodeOptions, setPincodeOptions] = useState([]); // Array of {label, value}

  // --- LOADING INDICATORS ---
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingPincodes, setIsLoadingPincodes] = useState(false);

  const fetchStates = useCallback(async () => {
    setIsLoadingStates(true);
    try {
      const states = await fetchIndiaStates();
      setStatesList(states);
    } catch (error) {
      console.error("Error fetching states:", error);
    } finally {
      setIsLoadingStates(false);
    }
  }, []);

  // --- 1. FETCH STATES (Run on mount if India is selected) ---
  useEffect(() => {
    if (values.country === "India") {
      fetchStates();
    }
  }, [values.country, fetchStates]);

  // --- 2. HANDLE STATE CHANGE -> FETCH DISTRICTS (Cities) ---
  const handleStateSelect = async (stateName) => {
    // Reset downstream
    setValues((prev) => ({
      ...prev,
      state: stateName,
      district: "",
      postalCode: "",
    }));
    setDistrictsList([]);
    setPincodeOptions([]);
    
    setStateOpen(false);
    setTouched((prev) => ({ ...prev, state: true }));

    // Fetch Districts (Cities)
    setIsLoadingDistricts(true);
    try {
      const districts = await fetchIndiaCities(stateName);
      setDistrictsList(districts);
    } catch (error) {
      console.error("Error fetching districts:", error);
    } finally {
      setIsLoadingDistricts(false);
    }
  };

  // --- 3. HANDLE DISTRICT CHANGE -> FETCH PINCODES ---
  const buildPincodeOptions = useCallback((rawData) => {
    const uniqueMap = new Map();
    rawData.forEach((item) => {
      const postOfficeName = item.Name || "";
      const blockName =
        item.Block && item.Block !== "NA" ? item.Block : item.District || "";

      const placeParts = [postOfficeName, blockName]
        .map((part) => part.trim())
        .filter(Boolean);

      const placeLabel = placeParts.join(" • ");
      const label = placeLabel ? `${placeLabel} — ${item.Pincode}` : item.Pincode;

      const value = item.Pincode;
      if (!uniqueMap.has(label)) uniqueMap.set(label, { label, value, key: label });
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const fetchPincodesForDistrict = useCallback(async (districtName) => {
    setPincodeOptions([]);
    if (!districtName) return;

    setIsLoadingPincodes(true);
    try {
      const raw = await fetchPincodesByDistrict(districtName);
      setPincodeOptions(buildPincodeOptions(raw));
    } catch (error) {
      console.error("Error fetching pincodes:", error);
    } finally {
      setIsLoadingPincodes(false);
    }
  }, [buildPincodeOptions]);

  const handleDistrictChange = async (e) => {
    const districtName = e.target.value;
    setValues((prev) => ({ ...prev, district: districtName, postalCode: "" }));
    await fetchPincodesForDistrict(districtName);
  };

  // --- EDIT MODE: preload values when "Update" clicked in table ---
  useEffect(() => {
    if (!editingProfile) return;
    setValues({ ...buildInitialValues(), ...editingProfile });
    setTouched({});

    if (editingProfile.country === "India") {
      if (!statesList.length) fetchStates();
      if (editingProfile.state) {
        setIsLoadingDistricts(true);
        fetchIndiaCities(editingProfile.state)
          .then((d) => setDistrictsList(d))
          .catch(() => {})
          .finally(() => setIsLoadingDistricts(false));
      }
      if (editingProfile.district) {
        fetchPincodesForDistrict(editingProfile.district);
      }
    }
  }, [editingProfile, fetchPincodesForDistrict, fetchStates, statesList.length]);

  // --- VALIDATION LOGIC ---
  const errors = useMemo(() => {
    const e = {};
    if (!required(values.username)) e.username = "Username is required";
    if (!required(values.firstName)) e.firstName = "First name is required";
    if (!required(values.lastName)) e.lastName = "Last name is required";
    if (!required(values.email)) {
      e.email = "Email is required";
    } else if (!isEmail(values.email)) {
      e.email = "Enter a valid email address";
    }

    // Conditional Validation based on Country
    if (values.country === "India") {
      if (!required(values.state)) e.state = "State is required";
      if (!required(values.district)) e.district = "District is required";
      if (!required(values.postalCode)) e.postalCode = "Pincode is required";
      if (!required(values.streetAddress)) e.streetAddress = "Street address is required";
    } else {
      // Non-Indian Resident: Only validate the general Address field
      if (!required(values.streetAddress)) e.streetAddress = "Address is required";
    }

    return e;
  }, [values]);

  const hasError = (name) => touched[name] && errors[name];

  const updateValue = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    updateValue(name, value);
  };

  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    setValues((prev) => ({
      ...prev,
      country: newCountry,
      // Reset location fields when country changes
      state: "",
      district: "",
      postalCode: "",
      streetAddress: "",
    }));
    // Reset lists
    setStatesList([]);
    setDistrictsList([]);
    setPincodeOptions([]);
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Avatar must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValues((prev) => ({ ...prev, avatarDataUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleNotificationToggle = (e) => {
    const { name, checked } = e.target;
    setValues((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [name]: checked },
    }));
  };

  const handlePushChange = (e) => {
    setValues((prev) => ({ ...prev, pushNotifications: e.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // 1. Create a local object to track validation errors immediately
    let validationErrors = {};
    
    // 2. Define the fields you want to validate
    const fieldsToCheck = [
      'username', 'about', 'firstName', 'lastName', 
      'email', 'country', 'streetAddress'
    ];

    // 3. Add conditional fields
    if (values.country === "India") {
      fieldsToCheck.push('state', 'district', 'postalCode');
    }

    // 4. Loop through fields to check if they are empty
    fieldsToCheck.forEach(field => {
      if (!values[field] || values[field].toString().trim() === "") {
        validationErrors[field] = "This field is required"; // Or your custom error message
      }
    });

    // 5. Create the touched object based on what we checked
    const fieldsToTouch = {};
    fieldsToCheck.forEach(field => {
        fieldsToTouch[field] = true;
    });

    // 6. Update your UI state
    // (Assuming you have a setErrors function, if not, the setTouched usually triggers the UI error display)
    if (typeof setErrors === 'function') {
        setErrors(validationErrors); 
    }
    setTouched(fieldsToTouch);

    // 7. STOP if there are local validation errors
    if (Object.keys(validationErrors).length > 0) {
        return; 
    }

    // --- PROCEED WITH SUBMISSION ---

    setSubmitting(true);
    setTimeout(() => {
      const id =
        editingId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      const payload = {
        ...values,
        id,
        createdAt: editingProfile?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      if (editingId) {
        dispatch(updateProfile({ id: editingId, changes: payload }));
        dispatch(cancelEdit());
      } else {
        dispatch(addProfile(payload));
      }

      setSubmitting(false);
      setValues(buildInitialValues());
      setTouched({});
      setDistrictsList([]);
      setPincodeOptions([]);
      navigate("/table");
    }, 250);
  };

  return (
    <form id="profile-form" className="profile-form" noValidate onSubmit={handleSubmit}>
      <div className="form-wrapper">
        <div className="form-top-actions">
          <button
            type="button"
            className="form-nav-button"
            onClick={() => navigate("/table")}
          >
            View submissions
          </button>
        </div>
        {/* Profile Section */}
        <div className="form-section">
          <h2 className="section-title">Profile</h2>
          <p className="section-desc">Public information.</p>
          <div className="fields-grid">
            <div className="field-col-span-4">
              <label htmlFor="username" className="form-label">Username</label>
              <div className="input-group-wrapper">
                <div className="input-group">
                  <span className="input-prefix">workcation.com/</span>
                  <input
                    id="username" name="username" type="text"
                    className="form-input-clean"
                    value={values.username} onChange={handleChange} onBlur={() => handleBlur("username")}
                  />
                </div>
              </div>
              {hasError("username") && <p className="field-error">{errors.username}</p>}
            </div>

            <div className="field-col-full">
              <label htmlFor="about" className="form-label">About</label>
              <textarea
                id="about" name="about" rows={3}
                className="form-textarea mt-2"
                value={values.about} onChange={handleChange} onBlur={() => handleBlur("about")}
              />
            </div>

            <div className="field-col-full">
              <label className="form-label">Photo</label>
              <div className="photo-upload-container">
                {values.avatarDataUrl ? (
                  <img src={values.avatarDataUrl} alt="Avatar preview" className="user-icon" />
                ) : (
                  <CircleUser className="user-icon" />
                )}
                <button type="button" className="btn-secondary" onClick={handleAvatarClick}>Change</button>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleAvatarChange} />
              </div>
            </div>

            <div className="field-col-full">
              <label className="form-label">Cover photo</label>
              <div className="dropzone">
                <div className="text-center">
                  <Image className="photo-icon" />
                  <p className="upload-help-text">PNG, JPG, GIF up to 10MB</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information Section */}
        <div className="form-section">
          <h2 className="section-title">Personal Information</h2>
          <p className="section-desc">Private address details.</p>

          <div className="fields-grid">
            <div className="field-col-span-3">
              <label htmlFor="firstName" className="form-label">First name</label>
              <input id="firstName" name="firstName" type="text" className="form-input mt-2" value={values.firstName} onChange={handleChange} onBlur={() => handleBlur("firstName")} />
              {hasError("firstName") && <p className="field-error">{errors.firstName}</p>}
            </div>

            <div className="field-col-span-3">
              <label htmlFor="lastName" className="form-label">Last name</label>
              <input id="lastName" name="lastName" type="text" className="form-input mt-2" value={values.lastName} onChange={handleChange} onBlur={() => handleBlur("lastName")} />
              {hasError("lastName") && <p className="field-error">{errors.lastName}</p>}
            </div>

            <div className="field-col-span-4">
              <label htmlFor="email" className="form-label">Email address</label>
              <input id="email" name="email" type="email" className="form-input mt-2" value={values.email} onChange={handleChange} onBlur={() => handleBlur("email")} />
              {hasError("email") && <p className="field-error">{errors.email}</p>}
            </div>

            {/* --- COUNTRY SELECTION --- */}
            <div className="field-col-span-4">
              <label htmlFor="country" className="form-label">Country / Residency Status</label>
              <select 
                id="country" 
                name="country" 
                className="form-input mt-2" 
                value={values.country} 
                onChange={handleCountryChange}
              >
                {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* --- CONDITIONAL RENDERING --- */}
            {values.country === "India" ? (
              <>
                {/* 1. STATE DROPDOWN */}
                <div className="field-col-span-2">
                  <label htmlFor="state" className="form-label">State</label>
                  <div className="relative mt-2">
                    <div
                      className={`form-input flex items-center justify-between cursor-pointer ${isLoadingStates ? 'bg-gray-50' : ''}`}
                      onClick={() => !isLoadingStates && setStateOpen((open) => !open)}
                    >
                      <span className={!values.state ? "text-gray-400" : ""}>
                        {isLoadingStates ? "Loading States..." : (values.state || "Select State")}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${stateOpen ? "rotate-180" : ""}`} />
                    </div>

                    {stateOpen && !isLoadingStates && (
                      <ul className="state-dropdown">
                        {statesList.map((stateObj) => (
                          <li
                            key={stateObj.name}
                            onClick={() => handleStateSelect(stateObj.name)}
                            className={`state-option ${values.state === stateObj.name ? "state-option--active" : ""}`}
                          >
                            <span className="state-option__label">{stateObj.name}</span>
                            {values.state === stateObj.name && <Check className="w-4 h-4" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {hasError("state") && <p className="field-error">{errors.state}</p>}
                </div>

                {/* 2. DISTRICT DROPDOWN */}
                <div className="field-col-span-2">
                  <label htmlFor="district" className="form-label">District / City</label>
                  <div className="mt-2 relative">
                    <select
                      id="district"
                      name="district"
                      className="form-input"
                      value={values.district}
                      onChange={handleDistrictChange}
                      onBlur={() => handleBlur("district")}
                      disabled={!values.state || isLoadingDistricts}
                    >
                      <option value="">
                        {isLoadingDistricts 
                          ? "Loading Districts..." 
                          : !values.state 
                          ? "Select State first" 
                          : "Select District"}
                      </option>
                      {districtsList.map((dist, index) => (
                        <option key={`${dist}-${index}`} value={dist}>{dist}</option>
                      ))}
                    </select>
                    {isLoadingDistricts && (
                      <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
                        <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      </div>
                    )}
                  </div>
                  {hasError("district") && <p className="field-error">{errors.district}</p>}
                </div>

                {/* 3. BLOCK / PINCODE DROPDOWN */}
                <div className="field-col-span-2">
                  <label htmlFor="postal-code" className="form-label">Block - Pincode</label>
                  <div className="mt-2 relative">
                    <select
                      id="postal-code"
                      name="postalCode"
                      className="form-input"
                      value={values.postalCode}
                      onChange={handleChange}
                      onBlur={() => handleBlur("postalCode")}
                      disabled={!values.district || isLoadingPincodes}
                    >
                      <option value="">
                        {isLoadingPincodes
                          ? "Loading Data..."
                          : !values.district
                          ? "Select District first"
                          : "Select Block - Pincode"}
                      </option>
                      {!isLoadingPincodes && pincodeOptions.map((opt) => (
                        <option key={opt.key} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {isLoadingPincodes && (
                      <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
                        <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      </div>
                    )}
                  </div>
                  {hasError("postalCode") && <p className="field-error">{errors.postalCode}</p>}
                </div>

                {/* 4. STREET ADDRESS */}
                <div className="field-col-span-2">
                  <label htmlFor="streetAddress" className="form-label">Street Address</label>
                  <input
                    id="streetAddress"
                    name="streetAddress"
                    type="text"
                    className="form-input mt-2"
                    placeholder="House No, Building, Street"
                    value={values.streetAddress}
                    onChange={handleChange}
                    onBlur={() => handleBlur("streetAddress")}
                  />
                  {hasError("streetAddress") && <p className="field-error">{errors.streetAddress}</p>}
                </div>
              </>
            ) : (
              // --- NON-INDIAN RESIDENT VIEW ---
              <div className="field-col-full">
                <label htmlFor="streetAddress" className="form-label">Full Address</label>
                <div className="mt-2">
                  <textarea
                    id="streetAddress"
                    name="streetAddress"
                    rows={4}
                    className="form-textarea"
                    placeholder="Enter your full international address here..."
                    value={values.streetAddress}
                    onChange={handleChange}
                    onBlur={() => handleBlur("streetAddress")}
                  />
                </div>
                {hasError("streetAddress") && <p className="field-error">{errors.streetAddress}</p>}
              </div>
            )}
          </div>
        </div>
        
        {/* Notifications Section */}
        <div className="form-section">
          <h2 className="section-title">Notifications</h2>
          <div className="notifications-wrapper">
             <fieldset>
              <legend className="legend-title">By email</legend>
              <div className="checkbox-group">
                <div className="checkbox-item">
                  <div className="checkbox-input-wrapper">
                    <div className="checkbox-container">
                      <input id="comments" name="comments" type="checkbox" className="form-checkbox" checked={values.notifications.comments} onChange={handleNotificationToggle} />
                    </div>
                  </div>
                  <div className="checkbox-text">
                    <label htmlFor="comments" className="checkbox-label">Comments</label>
                    <p className="checkbox-desc">Get notified when someones posts a comment on a posting.</p>
                  </div>
                </div>
                {/* Additional Checkboxes... */}
              </div>
            </fieldset>
             <fieldset>
              <legend className="legend-title">Push notifications</legend>
              <p className="section-desc">These are delivered via SMS to your mobile phone.</p>
              <div className="radio-group">
                <div className="radio-item">
                  <input id="push-everything" name="push-notifications" type="radio" className="form-radio" value="everything" checked={values.pushNotifications === "everything"} onChange={handlePushChange} />
                  <label htmlFor="push-everything" className="radio-label">Everything</label>
                </div>
                 <div className="radio-item">
                  <input id="push-nothing" name="push-notifications" type="radio" className="form-radio" value="nothing" checked={values.pushNotifications === "nothing"} onChange={handlePushChange} />
                  <label htmlFor="push-nothing" className="radio-label">No push notifications</label>
                </div>
              </div>
            </fieldset>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={() => {
            dispatch(cancelEdit());
            setValues(buildInitialValues());
            setTouched({});
            setDistrictsList([]);
            setPincodeOptions([]);
          }}
        >
          {editingId ? "Cancel update" : "Cancel"}
        </button>
        <button type="submit" className="btn-save" disabled={submitting || Object.keys(errors).length > 0}>
          {submitting ? "Saving..." : editingId ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
}