import React from "react";
import NavBar from "../../components/NavBar";
import "./Profile.css";
import {
  calculateDailyCalorieGoal,
  getProfile,
  updateProfile,
} from "../../services/profileClient";
import { getCurrentSession, getCurrentUserId } from "../../services/authClient";

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
  return `${numeric} kg (${Number(pounds.toFixed(1))} lb)`;
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

export default function Profile({ user }) {
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

  React.useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [{ session }, resolvedUserId] = await Promise.all([
          getCurrentSession(),
          user?.id ? Promise.resolve(user.id) : getCurrentUserId(),
        ]);
        if (!active) return;
        setUserId(resolvedUserId);
        setAccountEmail(session?.user?.email || "");

        const profile = await getProfile(resolvedUserId);
        if (!active) return;
        if (!profile) {
          setIsEditing(true);
          setMsg("Complete your profile to unlock your calorie goal.");
          return;
        }
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

        if (profile.height_cm) {
          setHeightCm(String(profile.height_cm));
          const { feetValue, inchesValue } = imperialFromCm(profile.height_cm);
          setFt(feetValue ? String(feetValue) : "");
          setInch(inchesValue ? String(inchesValue) : "");
        }

        if (profile.weight_kg) {
          setWeightKg(String(profile.weight_kg));
          const pounds = lbFromKg(profile.weight_kg);
          setLb(pounds ? String(Number(pounds.toFixed(1))) : "");
        }

        const hasAnyProfileData = Boolean(
          profile.display_name ||
          profile.dob ||
          profile.gender ||
          profile.height_cm ||
          profile.weight_kg ||
          profile.target_weight_kg ||
          profile.target_body_fat_pct
        );

        if (!hasAnyProfileData) {
          setIsEditing(true);
          setMsg("Complete your profile to unlock your calorie goal.");
        }
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
  }, [user?.id]);

  function onHeightUnitChange(nextUnit) {
    if (nextUnit === "imperial" && heightUnit !== "imperial") {
      const { feetValue, inchesValue } = imperialFromCm(heightCm || "0");
      setFt(feetValue ? String(feetValue) : "");
      setInch(inchesValue ? String(inchesValue) : "");
    }
    if (nextUnit === "cm" && heightUnit !== "cm") {
      const nextHeightCm = cmFromImperial(ft, inch);
      setHeightCm(nextHeightCm ? String(Number(nextHeightCm.toFixed(1))) : "");
    }
    setHeightUnit(nextUnit);
  }

  function onWeightUnitChange(nextUnit) {
    if (nextUnit === "lb" && weightUnit !== "lb") {
      const nextLb = lbFromKg(weightKg || "0");
      setLb(nextLb ? String(Number(nextLb.toFixed(1))) : "");
    }
    if (nextUnit === "kg" && weightUnit !== "kg") {
      const nextKg = kgFromLb(lb);
      setWeightKg(nextKg ? String(Number(nextKg.toFixed(1))) : "");
    }
    setWeightUnit(nextUnit);
  }

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

    if (!name.trim()) return setMsg("Please enter your name.");
    if (!(finalHeightCm > 50 && finalHeightCm < 300)) return setMsg("Height should be realistic.");
    if (!(finalWeightKg > 20 && finalWeightKg < 500)) return setMsg("Weight should be realistic.");
    if (targetWeight && !(nextTargetWeight > 20 && nextTargetWeight < 500)) return setMsg("Target weight invalid.");
    if (targetBf && !(nextTargetBf >= 0 && nextTargetBf <= 70)) return setMsg("Target body fat % invalid.");

    try {
      setSaving(true);
      await updateProfile({
        display_name: name.trim(),
        dob: dob || null,
        gender: gender || null,
        height_cm: Number(finalHeightCm.toFixed(1)),
        weight_kg: Number(finalWeightKg.toFixed(1)),
        activity_level: activityLevel || "sedentary",
        goal_weight_intent: goal,
        goal_muscle_intent: muscle,
        target_weight_kg: nextTargetWeight,
        target_body_fat_pct: nextTargetBf,
      }, userId);
      setSavedProfile({
        display_name: name.trim(),
        dob: dob || null,
        gender: gender || null,
        height_cm: Number(finalHeightCm.toFixed(1)),
        weight_kg: Number(finalWeightKg.toFixed(1)),
        activity_level: activityLevel || "sedentary",
        goal_weight_intent: goal,
        goal_muscle_intent: muscle,
        target_weight_kg: nextTargetWeight,
        target_body_fat_pct: nextTargetBf,
      });
      setIsEditing(false);
      setMsg("Profile saved.");
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

  const previewGoal = calculateDailyCalorieGoal({
    dob,
    gender,
    height_cm: heightUnit === "imperial" ? cmFromImperial(ft, inch) : Number(heightCm),
    weight_kg: weightUnit === "lb" ? kgFromLb(lb) : Number(weightKg),
    activity_level: activityLevel,
    goal_weight_intent: goal,
    goal_muscle_intent: muscle,
  });

  return (
    <main className="profile-page">
      <NavBar profileImageSrc={user?.avatar} />
      <div className="profile-shell">
        <section className="profile-card">
          <h1 className="profile-title">Profile</h1>
          <p className="profile-subtitle">
            Update the measurements and goals that drive your dashboard calorie target.
          </p>

          {loading ? (
            <p className="profile-status">Loading profileâ€¦</p>
          ) : !isEditing ? (
            <div className="profile-view">
              <div className="profile-grid">
                <div className="profile-field">
                  <span className="profile-field-label">Account</span>
                  <strong>{accountEmail || userId || "Unavailable"}</strong>
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
                  <span className="profile-field-label">Weight</span>
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
                  <strong>{targetWeight ? `${targetWeight} ${targetWeightUnit}` : "Unavailable"}</strong>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Target Body Fat</span>
                  <strong>{targetBf ? `${targetBf}%` : "Unavailable"}</strong>
                </div>
              </div>

              <div className="profile-preview">
                <span className="profile-preview-label">Calculated goal</span>
                <strong>{previewGoal ? `${previewGoal} kcal` : "Unavailable"}</strong>
              </div>

              {msg && <p className="profile-status">{msg}</p>}

              <div className="profile-actions">
                <button className="profile-save" type="button" onClick={handleEdit}>
                  Edit Profile
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="profile-form">
              <div className="profile-row">
                <div className="profile-col">
                  <label className="profile-label">Account</label>
                  <div className="profile-readonly">{accountEmail || userId || "Unavailable"}</div>
                </div>
              </div>

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
                    <option value="">Select…</option>
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
                  <label className="profile-label">Height</label>
                  <div className="profile-inline">
                    {heightUnit === "cm" ? (
                      <input
                        className="profile-input"
                        inputMode="decimal"
                        value={heightCm}
                        onChange={(e) => setHeightCm(cleanNum(e.target.value))}
                        placeholder="cm"
                      />
                    ) : (
                      <div className="profile-split">
                        <input
                          className="profile-input"
                          inputMode="numeric"
                          value={ft}
                          onChange={(e) => setFt(cleanNum(e.target.value, false))}
                          placeholder="ft"
                        />
                        <input
                          className="profile-input"
                          inputMode="decimal"
                          value={inch}
                          onChange={(e) => setInch(cleanNum(e.target.value))}
                          placeholder="in"
                        />
                      </div>
                    )}
                    <select
                      className="profile-input profile-select profile-unit"
                      value={heightUnit}
                      onChange={(e) => onHeightUnitChange(e.target.value)}
                    >
                      <option value="cm">cm</option>
                      <option value="imperial">ft/in</option>
                    </select>
                  </div>
                </div>

                <div className="profile-col">
                  <label className="profile-label">Weight</label>
                  <div className="profile-inline">
                    {weightUnit === "kg" ? (
                      <input
                        className="profile-input"
                        inputMode="decimal"
                        value={weightKg}
                        onChange={(e) => setWeightKg(cleanNum(e.target.value))}
                        placeholder="kg"
                      />
                    ) : (
                      <input
                        className="profile-input"
                        inputMode="decimal"
                        value={lb}
                        onChange={(e) => setLb(cleanNum(e.target.value))}
                        placeholder="lb"
                      />
                    )}
                    <select
                      className="profile-input profile-select profile-unit"
                      value={weightUnit}
                      onChange={(e) => onWeightUnitChange(e.target.value)}
                    >
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                    </select>
                  </div>
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
                  <div className="profile-inline">
                    <input
                      className="profile-input"
                      inputMode="decimal"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(cleanNum(e.target.value))}
                      placeholder={targetWeightUnit === "lb" ? "Optional lb" : "Optional kg"}
                    />
                    <select
                      className="profile-input profile-select profile-unit"
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

              <div className="profile-preview">
                <span className="profile-preview-label">Calculated goal</span>
                <strong>{previewGoal ? `${previewGoal} kcal` : "Unavailable"}</strong>
              </div>

              {msg && <p className="profile-status">{msg}</p>}

              <div className="profile-actions">
                <button className="profile-cancel" type="button" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button className="profile-save" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Profile"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
