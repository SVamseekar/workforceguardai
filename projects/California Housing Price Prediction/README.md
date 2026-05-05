# California Housing Price Prediction Project

## Project Overview
This project implements a complete machine learning pipeline to predict median house values in California using US Census data. The dataset contains information about 20,640 districts with various demographic, geographic, and economic features.

## Project Structure
```
California Housing Price Prediction/
│
├── data/
│   └── 1553768847_housing.xlsx          # Dataset (20,640 rows × 10 columns)
│
├── notebooks/
│   ├── California_Housing_Analysis.ipynb # Interactive Jupyter notebook
│   └── median_income_regression_plots.png # Visualization outputs
│
├── scripts/
│   └── california_housing_prediction.py  # Complete implementation script
│
└── README.md                             # This file
```

## Dataset Description
- **Size**: 20,640 rows × 10 columns
- **Target Variable**: median_house_value
- **Features**: 9 input features including:
  - Geographic: longitude, latitude
  - Housing: housing_median_age, total_rooms, total_bedrooms
  - Demographic: population, households
  - Economic: median_income
  - Categorical: ocean_proximity

## Implementation Details

### Data Preprocessing
1. **Missing Values**: Filled 207 missing values in `total_bedrooms` with column mean
2. **Categorical Encoding**: Applied Label Encoding to `ocean_proximity` feature
3. **Data Split**: 80% training (16,512 samples) / 20% testing (4,128 samples)
4. **Standardization**: Applied StandardScaler to all features

### Models Implemented
1. **Linear Regression** - Baseline linear model
2. **Decision Tree Regression** - Non-linear tree-based model
3. **Random Forest Regression** - Ensemble method
4. **Linear Regression (Median Income Only)** - Single feature model

## Results

### Model Performance (RMSE)
| Model | RMSE ($) | Performance |
|-------|----------|-------------|
| **Random Forest Regression** | **$50,211.91** | **Best** |
| Decision Tree Regression | $68,506.08 | Good |
| Linear Regression (All Features) | $71,098.70 | Baseline |
| Linear Regression (Median Income Only) | $84,209.01 | Single Feature |

### Key Insights
- **Random Forest** achieved the best performance with the lowest RMSE
- Using all features significantly improves prediction accuracy compared to using only median income
- The models successfully captured complex patterns in California housing prices
- Feature engineering and proper preprocessing were crucial for model performance

## Usage

### Running the Script
```bash
cd scripts/
python3 california_housing_prediction.py
```

### Running the Notebook
```bash
cd notebooks/
jupyter notebook California_Housing_Analysis.ipynb
```

## Requirements
- Python 3.9+
- pandas
- numpy
- matplotlib
- scikit-learn
- openpyxl
- seaborn (for notebook)

## Installation
```bash
pip3 install pandas numpy matplotlib scikit-learn openpyxl seaborn
```

## Project Requirements Fulfilled
✅ Load and explore the dataset
✅ Handle missing values with mean imputation
✅ Encode categorical data using Label Encoder
✅ Split dataset (80/20 train/test)
✅ Standardize features using StandardScaler
✅ Implement Linear Regression
✅ Implement Decision Tree Regression
✅ Implement Random Forest Regression
✅ Calculate RMSE for all models
✅ Bonus: Single feature Linear Regression with median_income
✅ Generate regression plots and visualizations

## Visualizations
The project generates:
- Regression plots for median income vs house value
- Model performance comparisons
- Data distribution plots
- Correlation matrices

All plots are saved as PNG files in the notebooks directory.

---
*Generated as part of California Housing Price Prediction Machine Learning Project*