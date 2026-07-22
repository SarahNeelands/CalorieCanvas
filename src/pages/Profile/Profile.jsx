import React from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/NavBar";
import "./Profile.css";
import {
  calculateBmr,
  calculateDailyCalorieGoal,
  getCachedProfile,
  getProfile,
  getLatestWeightKg,
  saveLocalProfile,
  updateProfile,
} from "../../services/profileClient";
import {
  getCurrentSession,
  getCurrentUserId,
  signOutCurrentUser,
} from "../../services/authClient";
import { completeProfileSetup } from "../../services/profileSetupProgress";
import { isLocalAuth } from "../../config/runtime";

const activityOptions = [
  { value: "sedentary", label: "Sedentary", help: "Mostly sitting with minimal exercise." },
  { value: "lightly_active", label: "Lightly active", help: "Light exercise 1 to 3 times per week." },
  { value: "moderately_active", label: "Moderately active", help: "Moderate exercise 3 to 5 times per week." },
  { value: "very_active", label: "Very active", help: "Hard exercise 6 to 7 times per week." },
  { value: "athlete", label: "Athlete-level", help: "Intense training or high-volume activity most days." },
];

function cleanNum(value, allowDot = true) {
  return (value ?? "").replace(allowDot ? /[^0-9.]/g : /[^0-9]/g, "");
}

function cmFromImperial(feet, inches) {
  return (parseInt(feet || 0, 10) * 12 + parseFloat(inches || 0)) * 2.54;
}

function imperialFromCm(cm) {
  const totalInches = parseFloat(cm || 0) / 2.54;
  const feetValue = Math.floor(totalInches / 12);
  const inchesValue = totalInches - feetValue * 12;
  return { feetValue, inchesValue: Number(inchesValue.toFixed(1)) };
}

function kgFromLb(value) {
  return parseFloat(value || 0) * 0.45359237;
}

function lbFromKg(value) {
  return parseFloat(value || 0) / 0.45359237;
}

function formatHeight(heightCm) {
  const numeric = Number(heightCm || 0);
  if (!(numeric > 0)) return "Unavailable";
  const { feetValue, inchesValue } = imperialFromCm(numeric);
  return `${numeric} cm (${feetValue}' ${inchesValue}")`;
}

function formatWeight(weightKg) {
  const numeric = Number(weightKg || 0);
  if (!(numeric > 0)) return "Unavailable";
  const pounds = lbFromKg(numeric);
  return `${Number(numeric.toFixed(2))} kg (${Number(pounds.toFixed(2))} lb)`;
}

function formatTargetWeight(weightKg) {
  const numeric = Number(weightKg || 0);
  if (!(numeric > 0)) return "Unavailable";
  const pounds = lbFromKg(numeric);
  return `${Number(numeric.toFixed(2))} kg (${Number(pounds.toFixed(2))} lb)`;
}

function formatGoalLabel(value) {
  const labels = {
    rapid_loss: "Rapid Weight Loss",
    normal_loss: "Normal Weight Loss",
    maintain: "Maintain",
    normal_gain: "Normal Weight Gain",
    rapid_gain: "Rapid Weight Gain",
  };
  return labels[value] || "Unavailable";
}

function formatMuscleLabel(value) {
  return value === "build" ? "Build muscle" : "Maintain muscle";
}

function formatActivityLabel(value) {
  return activityOptions.find((option) => option.value === value)?.label || "Sedentary";
}

function profileHasAnyData(profile) {
  if (!profile) return false;
  return Boolean(
    profile.display_name ||
    profile.dob ||
    profile.gender ||
    profile.height_cm ||
    profile.weight_kg ||
    profile.calorie_goal ||
    profile.target_weight_kg ||
    profile.target_body_fat_pct
  );
}

function formatAccountLabel({ accountEmail, isLocalAccount }) {
  if (accountEmail) return accountEmail;
  return isLocalAccount ? "Local account" : "Signed-in account";
}

export default function Profile({ user }) {
  const navigate = useNavigate();
  const [userId, setUserId] = React.useState(user?.id || null);
  const [accountEmail, setAccountEmail] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [savedProfile, setSavedProfile] = React.useState(null);

  const [name, setName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [heightUnit, setHeightUnit] = React.useState("cm");
  const [weightUnit, setWeightUnit] = React.useState("kg");
  const [heightCm, setHeightCm] = React.useState("");
  const [weightKg, setWeightKg] = React.useState("");
  const [ft, setFt] = React.useState("");
  const [inch, setInch] = React.useState("");
  const [lb, setLb] = React.useState("");
  const [goal, setGoal] = React.useState("maintain");
  const [muscle, setMuscle] = React.useState("maintain");
  const [activityLevel, setActivityLevel] = React.useState("sedentary");
  const [targetWeight, setTargetWeight] = React.useState("");
  const [targetWeightUnit, setTargetWeightUnit] = React.useState("kg");
  const [targetBf, setTargetBf] = React.useState("");
  const [calorieGoal, setCalorieGoal] = React.useState("");
  const [latestLoggedWeightKg, setLatestLoggedWeightKg] = React.useState(null);
  const [showCalories, setShowCalories] = React.useState(true);
  const [showMacros, setShowMacros] = React.useState(true);
  const [showMicros, setShowMicros] = React.useState(false);
  const accountLabel = formatAccountLabel({
    accountEmail,
    isLocalAccount: isLocalAuth(),
  });

  const applyProfile = React.useCallback((profile, options = {}) => {
    if (!profile) return;

    setSavedProfile(profile);
    setName(profile.display_name || "");
    setDob(profile.dob || "");
    setGender(profile.gender || "");
    setGoal(profile.goal_weight_intent || "maintain");
    setMuscle(profile.goal_muscle_intent || "maintain");
    setActivityLevel(profile.activity_level || "sedentary");
    setTargetWeight(profile.target_weight_kg ? String(profile.target_weight_kg) : "");
    setTargetWeightUnit("kg");
    setTargetBf(profile.target_body_fat_pct ? String(profile.target_body_fat_pct) : "");
    setCalorieGoal(profile.calorie_goal ? String(profile.calorie_goal) : "");
    setShowCalories(profile.pref_show_calories !== false);
    setShowMacros(profile.pref_show_macros !== false);
    setShowMicros(Boolean(profile.pref_show_micros));

    if (profile.height_cm) {
      setHeightCm(String(profile.height_cm));
      const { feetValue, inchesValue } = imperialFromCm(profile.height_cm);
      setFt(feetValue ? String(feetValue) : "");
      setInch(inchesValue ? String(inchesValue) : "");
    } else {
      setHeightCm("");
      setFt("");
      setInch("");
    }

    if (profile.weight_kg) {
      setWeightKg(String(profile.weight_kg));
      const pounds = lbFromKg(profile.weight_kg);
      setLb(pounds ? String(Number(pounds.toFixed(1))) : "");
    } else {
      setWeightKg("");
      setLb("");
    }

    if (!profileHasAnyData(profile)) {
      setIsEditing(true);
      if (options.setSetupMessage !== false) {
        setMsg("Complete your profile to unlock your calorie goal.");
      }
      return;
    }

    if (options.exitEdit !== false) {
      setIsEditing(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    async function load() {
      try {
        const resolvedUserId = user?.id ? user.id : await getCurrentUserId();
        if (!active) return;
        setUserId(resolvedUserId);
        const cachedProfile = getCachedProfile(resolvedUserId);
        if (cachedProfile) {
          applyProfile(cachedProfile);
          setLoading(false);
        }

        const [profile, latestWeightKg, sessionResult] = await Promise.all([
          getProfile(resolvedUserId),
          getLatestWeightKg(resolvedUserId).catch(() => null),
          getCurrentSession().catch(() => ({ session: null })),
        ]);
        if (!active) return;

        setAccountEmail(sessionResult?.session?.user?.email || "");
        setLatestLoggedWeightKg(latestWeightKg);

        if (!profile) {
          setIsEditing(true);
          setMsg("Complete your profile to unlock your calorie goal.");
          return;
        }

        applyProfile(profile);
      } catch (error) {
        if (!active) return;
        setMsg(error.message || "Failed to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [applyProfile, user?.id]);

  function onTargetWeightUnitChange(nextUnit) {
    if (nextUnit === targetWeightUnit) return;

    if (targetWeight) {
      const numericValue = parseFloat(targetWeight);
      if (Number.isFinite(numericValue)) {
        const convertedValue = nextUnit === "lb"
          ? lbFromKg(numericValue)
          : kgFromLb(numericValue);
        setTargetWeight(String(Number(convertedValue.toFixed(1))));
      }
    }

    setTargetWeightUnit(nextUnit);
  }

  async function handleSave(event) {
    event.preventDefault();
    setMsg(null);

    const finalHeightCm = heightUnit === "imperial" ? cmFromImperial(ft, inch) : parseFloat(heightCm);
    const finalWeightKg = weightUnit === "lb" ? kgFromLb(lb) : parseFloat(weightKg);
    const nextTargetWeight = targetWeight.trim()
      ? (targetWeightUnit === "lb" ? kgFromLb(Number(targetWeight)) : Number(targetWeight))
      : null;
    const nextTargetBf = targetBf.trim() ? Number(targetBf) : null;
    const nextCalorieGoal = calorieGoal.trim() ? Number(calorieGoal) : null;

    if (!name.trim()) return setMsg("Please enter your name.");
    if (!(finalHeightCm > 50 && finalHeightCm < 300)) return setMsg("Height should be realistic.");
    if (!(finalWeightKg > 20 && finalWeightKg < 500)) return setMsg("Weight should be realistic.");
    if (targetWeight && !(nextTargetWeight > 20 && nextTargetWeight < 500)) return setMsg("Target weight invalid.");
    if (targetBf && !(nextTargetBf >= 0 && nextTargetBf <= 70)) return setMsg("Target body fat % invalid.");
    if (calorieGoal && !(nextCalorieGoal >= 800 && nextCalorieGoal <= 5000)) return setMsg("Set calorie goal invalid.");

    const nextProfile = {
      display_name: name.trim(),
      dob: dob || null,
      gender: gender || null,
      height_cm: Number(finalHeightCm.toFixed(1)),
      weight_kg: Number(finalWeightKg.toFixed(1)),
      activity_level: activityLevel || "sedentary",
      goal_weight_intent: goal,
      goal_muscle_intent: muscle,
      calorie_goal: nextCalorieGoal,
      target_weight_kg: nextTargetWeight,
      target_body_fat_pct: nextTargetBf,
      pref_show_calories: showCalories,
      pref_show_macros: showMacros,
      pref_show_micros: showMicros,
    };

    try {
      setSaving(true);
      saveLocalProfile(userId, nextProfile);
      setSavedProfile(nextProfile);
      setIsEditing(false);
      setMsg("Profile saved.");

      if (isLocalAuth()) {
        await updateProfile(nextProfile, userId);
      } else {
        void updateProfile(nextProfile, userId).catch((error) => {
          console.warn("Failed to sync profile update", error);
          setMsg(error.message || "Profile saved locally. Cloud sync failed.");
        });
      }
    } catch (error) {
      setMsg(error.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  function restoreSavedProfile() {
    if (!savedProfile) return;
    setName(savedProfile.display_name || "");
    setDob(savedProfile.dob || "");
    setGender(savedProfile.gender || "");
    setGoal(savedProfile.goal_weight_intent || "maintain");
    setMuscle(savedProfile.goal_muscle_intent || "maintain");
    setActivityLevel(savedProfile.activity_level || "sedentary");
    setTargetWeight(savedProfile.target_weight_kg ? String(savedProfile.target_weight_kg) : "");
    setTargetWeightUnit("kg");
    setTargetBf(savedProfile.target_body_fat_pct ? String(savedProfile.target_body_fat_pct) : "");
    setCalorieGoal(savedProfile.calorie_goal ? String(savedProfile.calorie_goal) : "");
    setShowCalories(savedProfile.pref_show_calories !== false);
    setShowMacros(savedProfile.pref_show_macros !== false);
    setShowMicros(Boolean(savedProfile.pref_show_micros));
    setHeightUnit("cm");
    setWeightUnit("kg");
    setHeightCm(savedProfile.height_cm ? String(savedProfile.height_cm) : "");
    setWeightKg(savedProfile.weight_kg ? String(savedProfile.weight_kg) : "");

    if (savedProfile.height_cm) {
      const { feetValue, inchesValue } = imperialFromCm(savedProfile.height_cm);
      setFt(feetValue ? String(feetValue) : "");
      setInch(inchesValue ? String(inchesValue) : "");
    } else {
      setFt("");
      setInch("");
    }

    if (savedProfile.weight_kg) {
      const pounds = lbFromKg(savedProfile.weight_kg);
      setLb(pounds ? String(Number(pounds.toFixed(1))) : "");
    } else {
      setLb("");
    }
  }

  function handleEdit() {
    restoreSavedProfile();
    setMsg(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    restoreSavedProfile();
    setMsg(null);
    setIsEditing(false);
  }

  async function handleLogout() {
    setMsg(null);
    try {
      await signOutCurrentUser();
      completeProfileSetup();
      navigate("/login", { replace: true });
    } catch (error) {
      setMsg(error.message || "Failed to log out.");
    }
  }

  const effectiveWeightKg = latestLoggedWeightKg ?? (weightUnit === "lb" ? kgFromLb(lb) : Number(weightKg));

  const bmrValue = calculateBmr({
    dob,
    gender,
    height_cm: heightUnit === "imperial" ? cmFromImperial(ft, inch) : Number(heightCm),
    weight_kg: effectiveWeightKg,
  });

  const previewGoal = calculateDailyCalorieGoal({
    dob,
    gender,
    height_cm: heightUnit === "imperial" ? cmFromImperial(ft, inch) : Number(heightCm),
    weight_kg: effectiveWeightKg,
    activity_level: activityLevel,
    goal_weight_intent: goal,
    goal_muscle_intent: muscle,
  });

  return (
    <main className="profile-page">
      <NavBar profileImageSrc={user?.avatar} />
      <div className="profile-shell">
        <div className="profile-intro cc-page-heading">
          <h1 className="profile-title cc-page-title">Profile</h1>
          <p className="profile-subtitle cc-page-subtitle">
            Update the measurements and goals that drive your dashboard calorie target.
          </p>
        </div>

        <section className="profile-card">
          {loading ? (
            <p className="profile-status">Loading profile...</p>
          ) : !isEditing ? (
            <div className="profile-view">
              <div className="profile-grid">
                <div className="profile-field">
                  <span className="profile-field-label">Account</span>
                  <strong>{accountLabel}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Full Name</span>
                  <strong>{name || "Unavailable"}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Date of Birth</span>
                  <strong>{dob || "Unavailable"}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Gender</span>
                  <strong>{gender || "Unavailable"}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Activity Level</span>
                  <strong>{formatActivityLabel(activityLevel)}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Height</span>
                  <strong>{formatHeight(heightCm)}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Initial Weight</span>
                  <strong>{formatWeight(weightKg)}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Weight Goal</span>
                  <strong>{formatGoalLabel(goal)}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Muscle</span>
                  <strong>{formatMuscleLabel(muscle)}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Target Weight</span>
                  <strong>{formatTargetWeight(savedProfile?.target_weight_kg)}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Target Body Fat</span>
                  <strong>{targetBf ? `${targetBf}%` : "Unavailable"}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Show On Dashboard</span>
                  <strong>
                    {[
                      showCalories ? "Calories" : null,
                      showMacros ? "Macros" : null,
                      showMicros ? "Micros" : null,
                    ].filter(Boolean).join(", ") || "Nothing selected"}
                  </strong>
                </div>
              </div>

              <div className="profile-preview">
                <div className="profile-preview-metric">
                  <span className="profile-preview-label">Calculated Goal</span>
                  <strong>{previewGoal ? `${previewGoal} kcal` : "Unavailable"}</strong>
                </div>
                <div className="profile-preview-metric">
                  <span className="profile-preview-label">Set Calorie Goal</span>
                  <strong>{calorieGoal ? `${calorieGoal} kcal` : "Unavailable"}</strong>
                </div>
                <div className="profile-preview-metric">
                  <span className="profile-preview-label">BMR</span>
                  <strong>{bmrValue ? `${bmrValue} kcal` : "Unavailable"}</strong>
                </div>
              </div>

              {msg && <p className="profile-status">{msg}</p>}

              <div className="profile-actions">
                <button className="profile-logout" type="button" onClick={handleLogout}>
                  Log Out
                </button>
                <button className="profile-save" type="button" onClick={handleEdit}>
                  Edit Profile
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="profile-form">
              <div className="profile-row">
                <div className="profile-col">
                  <label className="profile-label" htmlFor="profile-name">Full Name</label>
                  <input
                    id="profile-name"
                    className="profile-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="profile-col">
                  <label className="profile-label" htmlFor="profile-dob">Date of Birth</label>
                  <input
                    id="profile-dob"
                    className="profile-input"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-col">
                  <label className="profile-label" htmlFor="profile-gender">Gender</label>
                  <select
                    id="profile-gender"
                    className="profile-input profile-select"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div className="profile-col">
                  <label className="profile-label profile-label-help" htmlFor="profile-activity">
                    <span>Activity Level</span>
                    <span className="profile-help" tabIndex={0} aria-label="Activity level guide">
                      ?
                      <span className="profile-tooltip">
                        {activityOptions.map((option) => (
                          <span key={option.value} className="profile-tooltip-line">
                            <strong>{option.label}:</strong> {option.help}
                          </span>
                        ))}
                      </span>
                    </span>
                  </label>
                  <select
                    id="profile-activity"
                    className="profile-input profile-select"
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                  >
                    {activityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-col">
                  <label className="profile-label">Weight Goal</label>
                  <select className="profile-input profile-select" value={goal} onChange={(e) => setGoal(e.target.value)}>
                    <option value="rapid_loss">Rapid Weight Loss</option>
                    <option value="normal_loss">Normal Weight Loss</option>
                    <option value="maintain">Maintain</option>
                    <option value="normal_gain">Normal Weight Gain</option>
                    <option value="rapid_gain">Rapid Weight Gain</option>
                  </select>
                </div>
                <div className="profile-col">
                  <label className="profile-label">Muscle</label>
                  <select className="profile-input profile-select" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
                    <option value="build">Build muscle</option>
                    <option value="maintain">Maintain muscle</option>
                  </select>
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-col">
                  <label className="profile-label">Target Weight</label>
                  <div className="profile-inline profile-inline--attached">
                    <input
                      className="profile-input"
                      inputMode="decimal"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(cleanNum(e.target.value))}
                      placeholder={targetWeightUnit === "lb" ? "Optional lb" : "Optional kg"}
                    />
                    <select
                      className="profile-input profile-select profile-unit profile-unit--attached"
                      value={targetWeightUnit}
                      onChange={(e) => onTargetWeightUnitChange(e.target.value)}
                    >
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                    </select>
                  </div>
                </div>
                <div className="profile-col">
                  <label className="profile-label">Target Body Fat %</label>
                  <input
                    className="profile-input"
                    inputMode="decimal"
                    value={targetBf}
                    onChange={(e) => setTargetBf(cleanNum(e.target.value))}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-col">
                  <label className="profile-label">Set Calorie Goal</label>
                  <input
                    className="profile-input"
                    inputMode="decimal"
                    value={calorieGoal}
                    onChange={(e) => setCalorieGoal(cleanNum(e.target.value, false))}
                    placeholder="Optional kcal"
                  />
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-col">
                  <label className="profile-label">Dashboard Modules</label>
                  <div className="profile-module-list">
                    <label className="profile-module-option">
                      <input
                        type="checkbox"
                        checked={showCalories}
                        onChange={() => setShowCalories((current) => !current)}
                      />
                      <span>Calories</span>
                    </label>
                    <label className="profile-module-option">
                      <input
                        type="checkbox"
                        checked={showMacros}
                        onChange={() => setShowMacros((current) => !current)}
                      />
                      <span>Macros</span>
                    </label>
                    <label className="profile-module-option">
                      <input
                        type="checkbox"
                        checked={showMicros}
                        onChange={() => setShowMicros((current) => !current)}
                      />
                      <span>Micros</span>
                    </label>
                  </div>
                </div>
              </div>

              {msg && <p className="profile-status">{msg}</p>}

              <div className="profile-actions">
                <button className="profile-cancel" type="button" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button className="profile-save" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
