#!/usr/bin/env python3
"""
California Housing Price Prediction Project
Author: Generated Script
Description: Complete implementation of California Housing Price Prediction as per project requirements
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
import warnings
warnings.filterwarnings('ignore')

def main():
    print("="*70)
    print("CALIFORNIA HOUSING PRICE PREDICTION PROJECT")
    print("="*70)

    # 1. Load the data
    print("\n1. LOADING THE DATA")
    print("-" * 30)
    data_path = '../data/1553768847_housing.xlsx'
    df = pd.read_excel(data_path)

    print(f"Dataset shape: {df.shape}")
    print("\nFirst few rows of the dataset:")
    print(df.head())

    # Extract input (X) and output (Y) data
    X = df.drop('median_house_value', axis=1)
    y = df['median_house_value']

    print(f"\nInput features (X) shape: {X.shape}")
    print(f"Target variable (y) shape: {y.shape}")
    print(f"\nFeature columns: {X.columns.tolist()}")

    # 2. Handle missing values
    print("\n2. HANDLING MISSING VALUES")
    print("-" * 35)
    print("Missing values before handling:")
    missing_before = X.isnull().sum()
    print(missing_before[missing_before > 0])

    # Fill missing values with mean of respective column
    X_filled = X.copy()
    for column in X_filled.columns:
        if X_filled[column].dtype in ['float64', 'int64']:
            X_filled[column].fillna(X_filled[column].mean(), inplace=True)

    print("\nMissing values after handling:")
    missing_after = X_filled.isnull().sum()
    print(missing_after[missing_after > 0])
    if missing_after.sum() == 0:
        print("No missing values remaining!")

    # 3. Encode categorical data
    print("\n3. ENCODING CATEGORICAL DATA")
    print("-" * 35)

    # Identify categorical columns
    categorical_cols = X_filled.select_dtypes(include=['object']).columns
    print(f"Categorical columns found: {categorical_cols.tolist()}")

    if len(categorical_cols) > 0:
        # Apply Label Encoding to categorical columns
        le = LabelEncoder()
        X_encoded = X_filled.copy()

        for col in categorical_cols:
            print(f"Encoding {col}: {X_filled[col].unique()}")
            X_encoded[col] = le.fit_transform(X_filled[col])
            print(f"Encoded values: {X_encoded[col].unique()}")
    else:
        X_encoded = X_filled.copy()

    # 4. Split the dataset
    print("\n4. SPLITTING THE DATASET")
    print("-" * 35)
    X_train, X_test, y_train, y_test = train_test_split(X_encoded, y, test_size=0.2, random_state=42)

    print(f"Training set size: {X_train.shape[0]} samples ({X_train.shape[0]/len(X_encoded)*100:.1f}%)")
    print(f"Test set size: {X_test.shape[0]} samples ({X_test.shape[0]/len(X_encoded)*100:.1f}%)")

    # 5. Standardize data
    print("\n5. STANDARDIZING DATA")
    print("-" * 30)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("Data standardization completed!")
    print(f"Training data mean: {np.mean(X_train_scaled, axis=0)[:3]}")  # Show first 3 features
    print(f"Training data std: {np.std(X_train_scaled, axis=0)[:3]}")   # Show first 3 features

    # 6. Perform Linear Regression
    print("\n6. LINEAR REGRESSION")
    print("-" * 30)
    lr_model = LinearRegression()
    lr_model.fit(X_train_scaled, y_train)

    y_pred_lr = lr_model.predict(X_test_scaled)
    rmse_lr = np.sqrt(mean_squared_error(y_test, y_pred_lr))

    print(f"Linear Regression RMSE: ${rmse_lr:,.2f}")

    # 7. Perform Decision Tree Regression
    print("\n7. DECISION TREE REGRESSION")
    print("-" * 40)
    dt_model = DecisionTreeRegressor(random_state=42)
    dt_model.fit(X_train_scaled, y_train)

    y_pred_dt = dt_model.predict(X_test_scaled)
    rmse_dt = np.sqrt(mean_squared_error(y_test, y_pred_dt))

    print(f"Decision Tree Regression RMSE: ${rmse_dt:,.2f}")

    # 8. Perform Random Forest Regression
    print("\n8. RANDOM FOREST REGRESSION")
    print("-" * 40)
    rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_model.fit(X_train_scaled, y_train)

    y_pred_rf = rf_model.predict(X_test_scaled)
    rmse_rf = np.sqrt(mean_squared_error(y_test, y_pred_rf))

    print(f"Random Forest Regression RMSE: ${rmse_rf:,.2f}")

    # 9. Bonus: Linear Regression with median_income only
    print("\n9. BONUS: LINEAR REGRESSION WITH MEDIAN_INCOME")
    print("-" * 55)

    # Extract median_income column
    median_income_idx = X.columns.get_loc('median_income')
    X_train_income = X_train_scaled[:, median_income_idx].reshape(-1, 1)
    X_test_income = X_test_scaled[:, median_income_idx].reshape(-1, 1)

    # Fit Linear Regression model
    lr_income_model = LinearRegression()
    lr_income_model.fit(X_train_income, y_train)

    y_pred_income = lr_income_model.predict(X_test_income)
    rmse_income = np.sqrt(mean_squared_error(y_test, y_pred_income))

    print(f"Linear Regression (median_income only) RMSE: ${rmse_income:,.2f}")

    # Plot the regression charts
    plt.figure(figsize=(15, 5))

    # Training data plot
    plt.subplot(1, 3, 1)
    plt.scatter(X_train_income, y_train, alpha=0.5, label='Training Data')
    plt.plot(X_train_income, lr_income_model.predict(X_train_income), color='red', linewidth=2, label='Regression Line')
    plt.xlabel('Median Income (Standardized)')
    plt.ylabel('Median House Value ($)')
    plt.title('Training Data: Median Income vs House Value')
    plt.legend()
    plt.grid(True, alpha=0.3)

    # Test data plot
    plt.subplot(1, 3, 2)
    plt.scatter(X_test_income, y_test, alpha=0.5, label='Test Data')
    plt.plot(X_test_income, y_pred_income, color='red', linewidth=2, label='Regression Line')
    plt.xlabel('Median Income (Standardized)')
    plt.ylabel('Median House Value ($)')
    plt.title('Test Data: Median Income vs House Value')
    plt.legend()
    plt.grid(True, alpha=0.3)

    # Combined plot
    plt.subplot(1, 3, 3)
    plt.scatter(X_train_income, y_train, alpha=0.3, label='Training Data', color='blue')
    plt.scatter(X_test_income, y_test, alpha=0.5, label='Test Data', color='orange')
    plt.plot(X_test_income, y_pred_income, color='red', linewidth=2, label='Regression Line')
    plt.xlabel('Median Income (Standardized)')
    plt.ylabel('Median House Value ($)')
    plt.title('Combined: Training + Test Data')
    plt.legend()
    plt.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig('../notebooks/median_income_regression_plots.png', dpi=300, bbox_inches='tight')
    plt.show()

    # Summary of Results
    print("\n" + "="*70)
    print("SUMMARY OF RESULTS")
    print("="*70)

    results = {
        'Linear Regression (All Features)': rmse_lr,
        'Decision Tree Regression': rmse_dt,
        'Random Forest Regression': rmse_rf,
        'Linear Regression (Median Income Only)': rmse_income
    }

    print(f"{'Model':<40} {'RMSE ($)':<15}")
    print("-" * 55)
    for model, rmse in results.items():
        print(f"{model:<40} {rmse:>12,.2f}")

    # Find best model
    best_model = min(results.items(), key=lambda x: x[1])
    print(f"\nBest performing model: {best_model[0]} with RMSE: ${best_model[1]:,.2f}")

    print("\nRegression plots saved to: ../notebooks/median_income_regression_plots.png")
    print("\nProject completed successfully!")

if __name__ == "__main__":
    main()