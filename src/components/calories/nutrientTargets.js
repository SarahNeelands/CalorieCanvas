function calculateAge(dob) {
  if (!dob) return 30;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 30;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  const beforeBirthday =
    monthDelta < 0 ||
    (monthDelta === 0 && today.getDate() < birthDate.getDate());

  if (beforeBirthday) age -= 1;
  return Math.max(18, age);
}

function normalizeGender(gender) {
  return String(gender || "").trim().toLowerCase();
}

function resolveActivityProteinMultiplier(activityLevel) {
  const normalized = String(activityLevel || "sedentary").trim().toLowerCase();
  const table = {
    sedentary: 1.4,
    lightly_active: 1.55,
    lightlyactive: 1.55,
    light: 1.55,
    moderately_active: 1.75,
    moderatelyactive: 1.75,
    moderate: 1.75,
    very_active: 1.95,
    veryactive: 1.95,
    athlete: 2.15,
    athlete_level: 2.15,
    athletelevel: 2.15,
  };

  return table[normalized] || 1.4;
}

export function macroTargetsByProfile(profile, goal) {
  if (!(Number(goal) > 0)) {
    return {
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fiber_g: null,
      sugar_g: null,
      cholesterol_mg: null,
    };
  }

  const weightKg = Number(profile?.weight_kg || 0);
  const proteinTarget = weightKg > 0
    ? Math.round(weightKg * resolveActivityProteinMultiplier(profile?.activity_level))
    : Math.round((goal * 0.24) / 4);
  const fatTarget = weightKg > 0
    ? Math.max(Math.round(weightKg * 0.7), Math.round((goal * 0.25) / 9))
    : Math.round((goal * 0.28) / 9);
  const remainingCarbsCalories = Math.max(
    0,
    goal - (proteinTarget * 4) - (fatTarget * 9)
  );

  return {
    protein_g: proteinTarget,
    carbs_g: Math.round(remainingCarbsCalories / 4),
    fat_g: fatTarget,
    fiber_g: Math.round((goal / 1000) * 14),
    sugar_g: Math.round((goal * 0.1) / 4),
    cholesterol_mg: 300,
  };
}

export function microTargetsByProfile(profile) {
  const age = calculateAge(profile?.dob);
  const gender = normalizeGender(profile?.gender);
  const isFemale = gender === "female";

  return {
    sodium_mg: 2300,
    potassium_mg: 4700,
    calcium_mg: age >= 51 ? 1200 : 1000,
    iron_mg: isFemale && age < 51 ? 18 : 8,
    vitamin_a_mcg: isFemale ? 700 : 900,
    vitamin_c_mg: isFemale ? 75 : 90,
  };
}
