<div align="center">

# 🧠 Mental Health Signal

**A student wellness prediction app — habits in, a clear signal out.**

[![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-RandomForest-F7931E?logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![License](https://img.shields.io/badge/License-Educational-lightgrey)]()

</div>

> ⚠️ **Built for informational purposes only.** This is not a clinical assessment.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Dataset](#dataset)
- [Model Pipeline](#model-pipeline)
- [Score Display](#score-display)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Running Locally](#running-locally)
- [Deployment Notes](#deployment-notes)
- [Known Limitations](#known-limitations)
- [Disclaimer](#disclaimer)

---

## 🔍 Overview

The app takes a short form of habit-related inputs — screen time, sleep, study hours, physical activity, and stress level — sends them to a FastAPI backend, and returns a predicted mental health score from a trained Random Forest model.

The raw score is remapped onto a simple **1–10 scale** and shown with a plain-language signal — **Low / Medium / Strong** — so the result is easy to read regardless of ML background.

---

## 🛠 Tech Stack

| Layer | Tools |
|---|---|
| **Model** | scikit-learn (`RandomForestRegressor`, wrapped in a `Pipeline` with preprocessing) |
| **Backend** | FastAPI · Pydantic · joblib |
| **Frontend** | HTML · CSS · JavaScript (vanilla, no framework) |
| **Data** | pandas · 5,000-row student survey dataset |

---

## 📊 Dataset

`Student_Social_Media_And_Mental_Health_Impact.csv` — **5,000 rows** · **13 columns**

<table>
<tr>
<td valign="top">

**Input features**
- Age
- Gender
- Country
- Academic Level
- Most-Used Platform
- Purpose of Use

</td>
<td valign="top">

**Input features (cont.)**
- Avg. Daily Usage Hours
- Daily Unlocks
- Study Hours
- Physical Activity Hours
- Sleep Hours per Night
- Stress Level

</td>
<td valign="top">

**Target**
- `Mental_Health_Score`
- Continuous, ranges **3.6 – 9.4** in the raw dataset

</td>
</tr>
</table>

---

## 🧬 Model Pipeline

The trained pipeline (`Mental_Helth_Model.pkl`) applies:

| Step | Features | Transform |
|---|---|---|
| 1 | Study Hours | Log transform → Standard scaling *(skewed distribution)* |
| 2 | Age, Screen Time, Unlocks, Activity, Sleep | Standard scaling |
| 3 | Stress Level | Ordinal encoding — `Low < Medium < High < Very High` |
| 4 | Gender, Country group, Academic Level, Platform, Purpose | One-hot encoding |
| 5 | — | **`RandomForestRegressor`** |

Rare countries are grouped into an `Other` bucket before encoding, based on a fixed list of common countries seen in the training data.

---

## 🎯 Score Display

The model's raw prediction is remapped onto a friendlier **1–10 scale** before being shown to the user, so the result doesn't depend on knowing the model's underlying score range.

> The remap bounds were found by running the trained model against **all 5,000 rows** of the real training dataset and taking the true min and max of its own predictions on real data — not synthetic or randomly generated inputs. That real range is then linearly stretched to fill 1–10.

<div align="center">

| Display Score | Signal |
|:---:|:---:|
| 🔴 1 – 3 | **Low** |
| 🟡 4 – 7 | **Medium** |
| 🟢 8 – 10 | **Strong** |

</div>

---

## 📁 Project Structure

```
.
├── main.py                                            # FastAPI backend
├── Mental_Helth_Model.pkl                             # Trained sklearn pipeline
├── index.html                                         # Frontend markup
├── style.css                                          # Frontend styling (light/dark theme)
├── script.js                                          # Frontend logic, remap + display
├── ML_Project.ipynb                                   # Model training notebook
└── Student_Social_Media_And_Mental_Health_Impact.csv   # Training dataset
```

---

## 🔌 API Reference

### `GET /`
Health check.

### `POST /predict`

<details open>
<summary><b>Request body</b></summary>

```json
{
  "age": 21,
  "gender": "Male",
  "country": "India",
  "academic_level": "Undergraduate",
  "most_used_platform": "Instagram",
  "purpose_of_use": "Entertainment",
  "avg_daily_usage_hours": 4.5,
  "daily_unlocks": 60,
  "study_hours": 5,
  "physical_activity_hours": 1.5,
  "sleep_hours_per_night": 7,
  "stress_level": "Medium"
}
```

</details>

<details open>
<summary><b>Response</b></summary>

```json
{
  "predicted_mental_health_score": 6.42
}
```

</details>

The frontend remaps this raw value to the 1–10 display scale and signal label client-side.

---

## 🚀 Running Locally

**1. Install backend dependencies**
```bash
pip install fastapi uvicorn pandas scikit-learn joblib --break-system-packages
```

**2. Start the backend**
```bash
uvicorn main:app --reload --port 8000
```

**3. Serve the frontend**
```bash
python3 -m http.server 5500
```
Then visit `http://127.0.0.1:5500`.

> 💡 Make sure `API_BASE` in `script.js` matches your backend's address (`http://127.0.0.1:8000` by default).

---

## ☁️ Deployment Notes

- On Render (or similar), the start command should bind to the platform's assigned port:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```
- After deploying the backend, update `API_BASE` in `script.js` to the live backend URL.
- Free-tier hosts that spin down on inactivity will have a slower first request after idling, while the server restarts and the model reloads into memory. Subsequent requests are fast.
- `CORS` is enabled for all origins by default in `main.py` — tighten `allow_origins` to your actual frontend domain before using this in production.

---

## ⚠️ Known Limitations

- The model was trained on a fixed set of platforms, countries, and categorical values; inputs outside those categories fall back to an `Other` grouping where applicable.
- Predictions on inputs far outside the training data's real value ranges (e.g. 0 hours of screen time, where no real row in the dataset has that value) are extrapolations and may not follow intuitive patterns.
- This tool does not diagnose or assess mental health in a clinical sense. It reflects patterns learned from a specific survey dataset and should not be used as a substitute for professional support.

---

## 📄 Disclaimer

This project is for educational and portfolio purposes. It is not a validated psychological instrument and should not be used to make decisions about anyone's health or wellbeing.

---

## 👤 Author

**Rajvardhan D. Shewale**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/rajvardhanshewale/)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?logo=github&logoColor=white)](https://github.com/Precipitation-Rain/)
[![Email](https://img.shields.io/badge/Email-Contact-D14836?logo=gmail&logoColor=white)](mailto:rajvardhanshewale7220@gmail.com)

<div align="center">

---

*Built with care, tested against real data.*

</div>