"""
Traffic Forecaster

v0.6 - Explainable forecasting using statistical methods.

Methods:
1. Moving Average: Smoothed recent trend
2. Linear Regression: Trend-based projection
3. Weighted Average: Recent values weighted higher
4. Ensemble: Combination of above methods

All methods are fully explainable - no black-box ML.
"""

import statistics
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import uuid4

import structlog

from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MetricType,
    TimeSeriesData,
    Forecast,
    ForecastPoint,
    ForecastMethod,
)

logger = structlog.get_logger()


class TrafficForecaster:
    """
    Forecasts traffic and metrics using explainable models.
    
    No black-box ML - all predictions are traceable to simple
    statistical methods.
    """
    
    def __init__(self, config: MonitoringConfig):
        """
        Initialize forecaster with configuration.
        
        Args:
            config: Monitoring configuration
        """
        self.config = config
        self.logger = logger.bind(component="TrafficForecaster")
    
    def forecast(
        self,
        time_series: TimeSeriesData,
        horizons: list[int] = [30, 60, 90],
    ) -> Optional[Forecast]:
        """
        Generate forecast for time series data.
        
        Args:
            time_series: Historical time series data
            horizons: Forecast horizons in days
            
        Returns:
            Forecast with predictions or None if insufficient data
        """
        values = time_series.values
        dates = time_series.dates
        
        if len(values) < self.config.forecast.min_data_points:
            self.logger.warning(
                "Insufficient data for forecasting",
                required=self.config.forecast.min_data_points,
                actual=len(values),
            )
            return None
        
        # Use ensemble method if enabled, else moving average
        if self.config.forecast.use_ensemble:
            method = ForecastMethod.ENSEMBLE
            forecast_func = self._ensemble_forecast
        else:
            method = ForecastMethod.MOVING_AVERAGE
            forecast_func = self._moving_average_forecast
        
        # Calculate forecasts for each horizon
        daily_forecasts: list[ForecastPoint] = []
        last_date = max(dates)
        
        max_horizon = max(horizons)
        for day in range(1, max_horizon + 1):
            forecast_date = last_date + timedelta(days=day)
            predicted, lower, upper, confidence = forecast_func(values, day)
            
            daily_forecasts.append(ForecastPoint(
                date=forecast_date,
                predicted_value=round(predicted, 2),
                lower_bound=round(lower, 2),
                upper_bound=round(upper, 2),
                confidence=round(confidence, 3),
            ))
        
        # Extract horizon forecasts
        horizon_forecasts = {}
        for h in sorted(horizons):
            if h <= len(daily_forecasts):
                horizon_forecasts[h] = daily_forecasts[h - 1]
            else:
                horizon_forecasts[h] = daily_forecasts[-1]
        
        # Calculate trend
        trend_direction, trend_strength = self._calculate_trend(values)
        
        # Calculate model accuracy (simple backtesting)
        accuracy = self._calculate_accuracy(values)
        
        # Generate explanation
        explanation = self._generate_explanation(
            trend_direction, trend_strength, method, values
        )
        
        forecast = Forecast(
            id=uuid4(),
            metric_type=time_series.metric_type,
            dimension=time_series.dimension,
            method=method,
            forecast_30d=horizon_forecasts.get(30, daily_forecasts[29] if len(daily_forecasts) >= 30 else daily_forecasts[-1]),
            forecast_60d=horizon_forecasts.get(60, daily_forecasts[59] if len(daily_forecasts) >= 60 else daily_forecasts[-1]),
            forecast_90d=horizon_forecasts.get(90, daily_forecasts[89] if len(daily_forecasts) >= 90 else daily_forecasts[-1]),
            daily_forecasts=daily_forecasts,
            model_accuracy=accuracy,
            trend_direction=trend_direction,
            trend_strength=trend_strength,
            explanation=explanation,
            factors=self._identify_factors(values, trend_direction),
            generated_at=datetime.now(),
        )
        
        self.logger.info(
            "Forecast generated",
            metric=time_series.metric_type.value,
            method=method.value,
            trend=trend_direction,
            accuracy=f"{accuracy:.1%}" if accuracy else "N/A",
        )
        
        return forecast
    
    def _moving_average_forecast(
        self,
        values: list[float],
        days_ahead: int,
    ) -> tuple[float, float, float, float]:
        """
        Simple moving average forecast.
        
        Args:
            values: Historical values
            days_ahead: Days to forecast ahead
            
        Returns:
            Tuple of (predicted, lower_bound, upper_bound, confidence)
        """
        window = min(self.config.forecast.ma_window, len(values))
        recent_values = values[-window:]
        
        ma = statistics.mean(recent_values)
        stdev = statistics.stdev(recent_values) if len(recent_values) > 1 else 0
        
        # Confidence decreases with horizon
        base_confidence = 0.9
        decay_rate = 0.005  # 0.5% per day
        confidence = max(0.5, base_confidence - decay_rate * days_ahead)
        
        # Wider intervals for longer horizons
        z_score = 1.96  # 95% CI
        interval = z_score * stdev * (1 + 0.01 * days_ahead)
        
        lower = ma - interval
        upper = ma + interval
        
        return ma, max(0, lower), upper, confidence
    
    def _linear_trend_forecast(
        self,
        values: list[float],
        days_ahead: int,
    ) -> tuple[float, float, float, float]:
        """
        Linear regression based forecast.
        
        Args:
            values: Historical values
            days_ahead: Days to forecast ahead
            
        Returns:
            Tuple of (predicted, lower_bound, upper_bound, confidence)
        """
        n = len(values)
        x = list(range(n))
        
        # Calculate linear regression coefficients
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(values)
        
        numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return y_mean, y_mean * 0.8, y_mean * 1.2, 0.5
        
        slope = numerator / denominator
        intercept = y_mean - slope * x_mean
        
        # Predict future value
        future_x = n + days_ahead - 1
        predicted = intercept + slope * future_x
        
        # Calculate residual standard error
        residuals = [values[i] - (intercept + slope * x[i]) for i in range(n)]
        rse = statistics.stdev(residuals) if len(residuals) > 1 else 0
        
        # Confidence interval
        z_score = 1.96
        interval = z_score * rse * (1 + 0.02 * days_ahead)
        
        # Confidence based on R-squared
        ss_res = sum(r ** 2 for r in residuals)
        ss_tot = sum((v - y_mean) ** 2 for v in values)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        confidence = max(0.4, min(0.95, r_squared * 0.8))
        confidence -= 0.003 * days_ahead  # Decay with horizon
        confidence = max(0.3, confidence)
        
        return predicted, max(0, predicted - interval), predicted + interval, confidence
    
    def _weighted_average_forecast(
        self,
        values: list[float],
        days_ahead: int,
    ) -> tuple[float, float, float, float]:
        """
        Exponentially weighted moving average forecast.
        
        More weight on recent values.
        
        Args:
            values: Historical values
            days_ahead: Days to forecast ahead
            
        Returns:
            Tuple of (predicted, lower_bound, upper_bound, confidence)
        """
        n = len(values)
        alpha = 0.3  # Smoothing factor
        
        # Calculate EMA
        ema = values[0]
        for i in range(1, n):
            ema = alpha * values[i] + (1 - alpha) * ema
        
        # Calculate variance
        variance = sum((v - ema) ** 2 for v in values) / n
        stdev = variance ** 0.5
        
        # Confidence
        confidence = max(0.5, 0.85 - 0.004 * days_ahead)
        
        # Interval
        interval = 1.96 * stdev * (1 + 0.015 * days_ahead)
        
        return ema, max(0, ema - interval), ema + interval, confidence
    
    def _ensemble_forecast(
        self,
        values: list[float],
        days_ahead: int,
    ) -> tuple[float, float, float, float]:
        """
        Ensemble forecast combining multiple methods.
        
        Weights methods by their characteristics:
        - MA: Stable, good for short-term
        - Linear: Good for trends
        - Weighted: Responsive to recent changes
        
        Args:
            values: Historical values
            days_ahead: Days to forecast ahead
            
        Returns:
            Tuple of (predicted, lower_bound, upper_bound, confidence)
        """
        # Get individual forecasts
        ma_pred, ma_lower, ma_upper, ma_conf = self._moving_average_forecast(values, days_ahead)
        lr_pred, lr_lower, lr_upper, lr_conf = self._linear_trend_forecast(values, days_ahead)
        wa_pred, wa_lower, wa_upper, wa_conf = self._weighted_average_forecast(values, days_ahead)
        
        # Weight by confidence
        total_conf = ma_conf + lr_conf + wa_conf
        if total_conf == 0:
            total_conf = 1
        
        w_ma = ma_conf / total_conf
        w_lr = lr_conf / total_conf
        w_wa = wa_conf / total_conf
        
        # Weighted average
        predicted = w_ma * ma_pred + w_lr * lr_pred + w_wa * wa_pred
        lower = w_ma * ma_lower + w_lr * lr_lower + w_wa * wa_lower
        upper = w_ma * ma_upper + w_lr * lr_upper + w_wa * wa_upper
        
        # Ensemble confidence (slightly higher than average)
        confidence = (ma_conf + lr_conf + wa_conf) / 3 + 0.05
        confidence = min(0.95, confidence)
        
        return predicted, max(0, lower), upper, confidence
    
    def _calculate_trend(self, values: list[float]) -> tuple[str, float]:
        """
        Calculate trend direction and strength.
        
        Args:
            values: Historical values
            
        Returns:
            Tuple of (direction, strength)
        """
        if len(values) < 7:
            return "stable", 0.0
        
        # Compare first and second half
        mid = len(values) // 2
        first_half = statistics.mean(values[:mid])
        second_half = statistics.mean(values[mid:])
        
        if first_half == 0:
            return "stable", 0.0
        
        change_ratio = (second_half - first_half) / first_half
        
        # Determine direction
        if change_ratio > 0.05:
            direction = "increasing"
        elif change_ratio < -0.05:
            direction = "decreasing"
        else:
            direction = "stable"
        
        # Strength (0-1)
        strength = min(1.0, abs(change_ratio) * 2)
        
        return direction, round(strength, 3)
    
    def _calculate_accuracy(self, values: list[float]) -> Optional[float]:
        """
        Calculate model accuracy using simple backtesting.
        
        Uses MAPE (Mean Absolute Percentage Error) on recent data.
        
        Args:
            values: Historical values
            
        Returns:
            Accuracy as 1 - MAPE, or None if insufficient data
        """
        if len(values) < 14:
            return None
        
        # Use last 7 days for testing
        train = values[:-7]
        test = values[-7:]
        
        # Predict using training data
        errors = []
        for i, actual in enumerate(test):
            pred, _, _, _ = self._moving_average_forecast(train + test[:i], 1)
            if actual > 0:
                error = abs(pred - actual) / actual
                errors.append(error)
        
        if not errors:
            return None
        
        mape = statistics.mean(errors)
        accuracy = max(0, 1 - mape)
        
        return round(accuracy, 3)
    
    def _generate_explanation(
        self,
        trend_direction: str,
        trend_strength: float,
        method: ForecastMethod,
        values: list[float],
    ) -> str:
        """
        Generate human-readable explanation.
        
        Args:
            trend_direction: Trend direction
            trend_strength: Trend strength
            method: Method used
            values: Historical values
            
        Returns:
            Explanation string
        """
        recent_avg = statistics.mean(values[-7:]) if len(values) >= 7 else statistics.mean(values)
        overall_avg = statistics.mean(values)
        
        parts = []
        
        # Describe trend
        if trend_direction == "increasing":
            parts.append(f"The metric shows an {trend_direction} trend")
            if trend_strength > 0.5:
                parts.append("with strong momentum")
        elif trend_direction == "decreasing":
            parts.append(f"The metric shows a {trend_direction} trend")
            if trend_strength > 0.5:
                parts.append("that requires attention")
        else:
            parts.append("The metric is relatively stable")
        
        # Describe method
        method_desc = {
            ForecastMethod.MOVING_AVERAGE: "using moving average smoothing",
            ForecastMethod.LINEAR_TREND: "using linear trend projection",
            ForecastMethod.WEIGHTED_AVERAGE: "using weighted recent values",
            ForecastMethod.ENSEMBLE: "using an ensemble of statistical methods",
        }
        parts.append(f"Forecast generated {method_desc.get(method, '')}")
        
        # Recent vs overall
        if overall_avg > 0:
            recent_vs_overall = (recent_avg - overall_avg) / overall_avg * 100
            if abs(recent_vs_overall) > 10:
                direction = "above" if recent_vs_overall > 0 else "below"
                parts.append(f"Recent average is {abs(recent_vs_overall):.0f}% {direction} historical average")
        
        return ". ".join(parts) + "."
    
    def _identify_factors(
        self,
        values: list[float],
        trend_direction: str,
    ) -> list[str]:
        """
        Identify factors that may affect the forecast.
        
        Args:
            values: Historical values
            trend_direction: Current trend
            
        Returns:
            List of factors
        """
        factors = []
        
        # Volatility factor
        if len(values) > 7:
            stdev = statistics.stdev(values)
            mean = statistics.mean(values)
            cv = stdev / mean if mean > 0 else 0
            if cv > 0.3:
                factors.append("High volatility may reduce forecast accuracy")
        
        # Trend factor
        if trend_direction == "decreasing":
            factors.append("Current downward trend factored into projection")
        elif trend_direction == "increasing":
            factors.append("Current upward trend factored into projection")
        
        # Data recency
        factors.append("Forecast based on recent historical patterns")
        
        # Limitations
        factors.append("External factors (algorithm updates, competition) not modeled")
        
        return factors
