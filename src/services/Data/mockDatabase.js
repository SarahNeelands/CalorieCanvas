// This is your fake "database"
export const mockMeals = [
    {
        id: "m1",
        userId: "1",
        date: "2025-11-19",
        time: "12:30",

        name: "Chicken & Rice",
        servingSize: 200,
        servingUnit: "grams",

        macros: {
            calories: 600,
            protein: 45,
            carbs: 60,
            fat: 15
        },

        micros: {
            fiber: 2,
            sugar: 1,
            sodium: 400,
            iron: 2.5,
            potassium: 550,
            calcium: null,
            vitaminA: null,
            vitaminC: null
        }
    },

    {
        id: "m2",
        userId: "1",
        date: "2025-11-19",
        time: "08:15",

        name: "Greek Yogurt with Honey",
        servingSize: 0.75,
        servingUnit: "cup",

        macros: {
            calories: 190,
            protein: 14,
            carbs: 22,
            fat: 2
        },

        micros: {
            calcium: 180,
            sodium: 55,
            sugar: 18,
            potassium: 240,
            iron: 0.1,
            fiber: 0,
            vitaminA: 15,
            vitaminC: null
        }
    },

    {
        id: "m3",
        userId: "1",
        date: "2025-11-19",
        time: "10:45",

        name: "Avocado Toast",
        servingSize: 1,
        servingUnit: "slice",

        macros: {
            calories: 260,
            protein: 6,
            carbs: 26,
            fat: 16
        },

        micros: {
            fiber: 7,
            sodium: 220,
            potassium: 480,
            iron: 1,
            calcium: 25,
            sugar: 2,
            vitaminA: 10,
            vitaminC: 6
        }
    },

    {
        id: "m4",
        userId: "1",
        date: "2025-11-20",
        time: "09:00",

        name: "Iced Coffee with Milk",
        servingSize: 350,
        servingUnit: "ml",

        macros: {
            calories: 110,
            protein: 4,
            carbs: 16,
            fat: 3
        },

        micros: {
            calcium: 130,
            potassium: 210,
            sodium: 65,
            sugar: 14,
            fiber: 0,
            iron: 0,
            vitaminA: 40,
            vitaminC: null
        }
    },

    {
        id: "m5",
        userId: "1",
        date: "2025-11-20",
        time: "18:20",

        name: "Grilled Salmon",
        servingSize: 6,
        servingUnit: "oz",

        macros: {
            calories: 367,
            protein: 39,
            carbs: 0,
            fat: 22
        },

        micros: {
            iron: 0.7,
            potassium: 634,
            sodium: 90,
            calcium: 12,
            vitaminA: 45,
            vitaminC: null,
            fiber: 0,
            sugar: 0
        }
    },

    {
        id: "m6",
        userId: "1",
        date: "2025-11-20",
        time: "15:40",

        name: "Mixed Berries",
        servingSize: 1,
        servingUnit: "cup",

        macros: {
            calories: 70,
            protein: 1,
            carbs: 17,
            fat: 0
        },

        micros: {
            fiber: 4,
            sugar: 10,
            vitaminC: 36,
            potassium: 120,
            sodium: 1,
            iron: 0.4,
            calcium: 15,
            vitaminA: 2
        }
    },

    {
        id: "m7",
        userId: "1",
        date: "2025-11-20",
        time: "21:10",

        name: "Peanut Butter",
        servingSize: 2,
        servingUnit: "tbsp",

        macros: {
            calories: 190,
            protein: 7,
            carbs: 8,
            fat: 16
        },

        micros: {
            fiber: 2,
            sugar: 3,
            sodium: 140,
            iron: 0.6,
            potassium: 190,
            calcium: 10,
            vitaminA: null,
            vitaminC: null
        }
    }

];


export const mockUsers = [
  {
    id: "1",
    name: "Sarah",
    birthday: "2003-05-03",

    heightUnit: "cm",
    height: 171,

    weightUnit: "lbs",
    weight: 185,

  },

  {
    id: "2",
    name: "Jake",
    birthday: "1985-05-03",

    heightUnit: "cm",
    height: 180,

    weightUnit: "lbs",
    weight: 190
  },

  {
    id: "3",
    name: "Matthew",
    birthday: "2001-01-05",

    heightUnit: "cm",
    height: 180,

    weightUnit: "lbs",
    weight: 190
  }
];

