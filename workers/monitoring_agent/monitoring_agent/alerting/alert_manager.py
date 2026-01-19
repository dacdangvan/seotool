"""
Alert Manager

v0.6 - Generates actionable alerts from anomalies and forecasts.

Alerts include:
- Priority classification
- Investigation steps
- Recommended actions
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

import structlog

from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MetricType,
    Anomaly,
    AnomalySeverity,
    AnomalyType,
    Forecast,
    Alert,
    AlertPriority,
    InvestigationStep,
)

logger = structlog.get_logger()


class AlertManager:
    """
    Manages alert generation from anomalies and forecasts.
    
    Generates actionable alerts with investigation steps.
    """
    
    def __init__(self, config: MonitoringConfig):
        """
        Initialize alert manager.
        
        Args:
            config: Monitoring configuration
        """
        self.config = config
        self.logger = logger.bind(component="AlertManager")
    
    def generate_alerts(
        self,
        anomalies: list[Anomaly],
        forecasts: list[Forecast],
    ) -> list[Alert]:
        """
        Generate alerts from anomalies and forecasts.
        
        Args:
            anomalies: Detected anomalies
            forecasts: Generated forecasts
            
        Returns:
            List of alerts
        """
        alerts: list[Alert] = []
        
        # Generate alerts from anomalies
        for anomaly in anomalies:
            alert = self._create_anomaly_alert(anomaly)
            if alert:
                alerts.append(alert)
        
        # Generate alerts from negative forecasts
        for forecast in forecasts:
            alert = self._create_forecast_alert(forecast)
            if alert:
                alerts.append(alert)
        
        # Limit alerts
        alerts = sorted(alerts, key=lambda a: self._priority_order(a.priority))
        alerts = alerts[:self.config.alert.max_alerts_per_run]
        
        self.logger.info(
            "Alerts generated",
            total=len(alerts),
            from_anomalies=sum(1 for a in alerts if a.anomaly_id),
            from_forecasts=sum(1 for a in alerts if a.forecast_id),
        )
        
        return alerts
    
    def _priority_order(self, priority: AlertPriority) -> int:
        """Get sort order for priority (lower = more important)."""
        order = {
            AlertPriority.CRITICAL: 0,
            AlertPriority.URGENT: 1,
            AlertPriority.WARNING: 2,
            AlertPriority.INFO: 3,
        }
        return order.get(priority, 4)
    
    def _create_anomaly_alert(self, anomaly: Anomaly) -> Optional[Alert]:
        """
        Create alert from anomaly.
        
        Args:
            anomaly: Detected anomaly
            
        Returns:
            Alert or None if below threshold
        """
        # Check minimum severity
        severity_order = {
            AnomalySeverity.LOW: 1,
            AnomalySeverity.MEDIUM: 2,
            AnomalySeverity.HIGH: 3,
            AnomalySeverity.CRITICAL: 4,
        }
        
        min_severity = self.config.alert.min_severity_for_alert
        min_order = severity_order.get(AnomalySeverity(min_severity), 2)
        
        if severity_order.get(anomaly.severity, 0) < min_order:
            return None
        
        # Map severity to priority
        priority_map = {
            AnomalySeverity.LOW: AlertPriority.INFO,
            AnomalySeverity.MEDIUM: AlertPriority.WARNING,
            AnomalySeverity.HIGH: AlertPriority.URGENT,
            AnomalySeverity.CRITICAL: AlertPriority.CRITICAL,
        }
        priority = priority_map.get(anomaly.severity, AlertPriority.WARNING)
        
        # Generate title
        title = self._generate_anomaly_title(anomaly)
        
        # Generate description
        description = self._generate_anomaly_description(anomaly)
        
        # Generate investigation steps
        steps = self._generate_investigation_steps(anomaly)
        
        # Generate recommended actions
        actions = self._generate_recommended_actions(anomaly)
        
        # Calculate expiration
        expiration = datetime.now() + timedelta(hours=self.config.alert.alert_expiration_hours)
        
        return Alert(
            id=uuid4(),
            priority=priority,
            title=title,
            description=description,
            anomaly_id=anomaly.id,
            metric_type=anomaly.metric_type,
            dimension=anomaly.dimension,
            current_value=anomaly.current_value,
            threshold_value=anomaly.expected_value,
            investigation_steps=steps,
            recommended_actions=actions,
            created_at=datetime.now(),
            expires_at=expiration,
        )
    
    def _create_forecast_alert(self, forecast: Forecast) -> Optional[Alert]:
        """
        Create alert from negative forecast.
        
        Args:
            forecast: Traffic forecast
            
        Returns:
            Alert or None if no negative trend
        """
        if forecast.trend_direction != "decreasing":
            return None
        
        # Calculate expected decline
        current = forecast.daily_forecasts[0].predicted_value if forecast.daily_forecasts else 0
        future_30d = forecast.forecast_30d.predicted_value
        
        if current == 0:
            return None
        
        decline_percent = (current - future_30d) / current * 100
        
        # Check threshold
        if decline_percent < self.config.alert.negative_forecast_threshold:
            return None
        
        # Determine priority based on decline severity
        if decline_percent >= 30:
            priority = AlertPriority.CRITICAL
        elif decline_percent >= 20:
            priority = AlertPriority.URGENT
        else:
            priority = AlertPriority.WARNING
        
        title = f"Forecasted {decline_percent:.0f}% decline in {forecast.metric_type.value}"
        
        description = (
            f"Based on current trends, {forecast.metric_type.value} is projected to "
            f"decline by {decline_percent:.1f}% over the next 30 days. "
            f"{forecast.explanation}"
        )
        
        steps = [
            InvestigationStep(
                order=1,
                action="Review recent content and technical changes",
                tool_or_resource="CMS / Git history",
                expected_outcome="Identify potential causes of decline",
            ),
            InvestigationStep(
                order=2,
                action="Check Google Search Console for issues",
                tool_or_resource="Google Search Console",
                expected_outcome="Identify indexing or ranking issues",
            ),
            InvestigationStep(
                order=3,
                action="Analyze competitor movements",
                tool_or_resource="SEO tools (Ahrefs, SEMrush)",
                expected_outcome="Understand competitive landscape changes",
            ),
        ]
        
        actions = [
            "Prioritize content optimization for declining pages",
            "Review and update technical SEO elements",
            "Consider new content creation for traffic recovery",
        ]
        
        return Alert(
            id=uuid4(),
            priority=priority,
            title=title,
            description=description,
            forecast_id=forecast.id,
            metric_type=forecast.metric_type,
            dimension=forecast.dimension,
            current_value=current,
            threshold_value=future_30d,
            investigation_steps=steps,
            recommended_actions=actions,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=self.config.alert.alert_expiration_hours),
        )
    
    def _generate_anomaly_title(self, anomaly: Anomaly) -> str:
        """Generate alert title from anomaly."""
        metric_name = anomaly.metric_type.value.replace("_", " ").title()
        
        type_verbs = {
            AnomalyType.SUDDEN_DROP: "dropped",
            AnomalyType.SUDDEN_SPIKE: "spiked",
            AnomalyType.GRADUAL_DECLINE: "declining",
            AnomalyType.GRADUAL_INCREASE: "increasing",
            AnomalyType.VOLATILITY: "showing high volatility",
            AnomalyType.FLATLINE: "flatlined",
        }
        
        verb = type_verbs.get(anomaly.anomaly_type, "changed")
        
        if anomaly.dimension:
            return f"{metric_name} {verb} for '{anomaly.dimension}'"
        return f"{metric_name} {verb} by {abs(anomaly.deviation_percent):.0f}%"
    
    def _generate_anomaly_description(self, anomaly: Anomaly) -> str:
        """Generate detailed description from anomaly."""
        parts = []
        
        # Main observation
        direction = "decreased" if anomaly.is_negative else "increased"
        parts.append(
            f"{anomaly.metric_type.value.replace('_', ' ').title()} has {direction} "
            f"by {abs(anomaly.deviation_percent):.1f}% compared to the baseline."
        )
        
        # Statistics
        parts.append(
            f"Current value: {anomaly.current_value:.2f}, "
            f"Expected: {anomaly.expected_value:.2f}"
        )
        
        if anomaly.z_score:
            parts.append(f"Statistical significance: {abs(anomaly.z_score):.1f} standard deviations from mean")
        
        # Top hypothesis
        if anomaly.hypotheses:
            top_hypothesis = anomaly.hypotheses[0]
            parts.append(f"Possible cause: {top_hypothesis.description}")
        
        return " ".join(parts)
    
    def _generate_investigation_steps(self, anomaly: Anomaly) -> list[InvestigationStep]:
        """Generate investigation steps from anomaly."""
        steps: list[InvestigationStep] = []
        order = 1
        
        # Use hypothesis investigation steps
        for hypothesis in anomaly.hypotheses[:2]:  # Top 2 hypotheses
            for step_text in hypothesis.investigation_steps[:2]:  # Top 2 steps each
                steps.append(InvestigationStep(
                    order=order,
                    action=step_text,
                    tool_or_resource=self._get_tool_for_step(step_text),
                    expected_outcome=self._get_outcome_for_step(step_text, anomaly),
                ))
                order += 1
        
        # Add generic steps if needed
        if len(steps) < 3:
            generic_steps = self._get_generic_steps(anomaly.metric_type)
            for gs in generic_steps[:3 - len(steps)]:
                steps.append(InvestigationStep(
                    order=order,
                    action=gs["action"],
                    tool_or_resource=gs["tool"],
                    expected_outcome=gs["outcome"],
                ))
                order += 1
        
        return steps
    
    def _get_tool_for_step(self, step_text: str) -> Optional[str]:
        """Determine appropriate tool for investigation step."""
        step_lower = step_text.lower()
        
        tool_mapping = {
            "gsc": "Google Search Console",
            "search console": "Google Search Console",
            "coverage": "Google Search Console",
            "indexing": "Google Search Console",
            "serp": "SERP checker tool",
            "competitor": "Ahrefs / SEMrush",
            "backlink": "Ahrefs / Majestic",
            "robots.txt": "Server / robots.txt file",
            "mobile": "Google Mobile-Friendly Test",
            "server": "Server logs / monitoring",
            "trends": "Google Trends",
            "title": "CMS / SEO tool",
        }
        
        for keyword, tool in tool_mapping.items():
            if keyword in step_lower:
                return tool
        
        return None
    
    def _get_outcome_for_step(self, step_text: str, anomaly: Anomaly) -> Optional[str]:
        """Determine expected outcome for investigation step."""
        step_lower = step_text.lower()
        
        if "error" in step_lower or "issue" in step_lower:
            return "Identify any technical issues affecting the site"
        elif "competitor" in step_lower:
            return "Understand competitive landscape changes"
        elif "ranking" in step_lower:
            return "Identify specific ranking changes"
        elif "content" in step_lower:
            return "Find content that may need optimization"
        elif "backlink" in step_lower:
            return "Identify link profile changes"
        
        return f"Gather data to explain {anomaly.anomaly_type.value}"
    
    def _get_generic_steps(self, metric_type: MetricType) -> list[dict]:
        """Get generic investigation steps for a metric type."""
        steps_by_metric = {
            MetricType.ORGANIC_TRAFFIC: [
                {
                    "action": "Check Google Search Console for any notices or manual actions",
                    "tool": "Google Search Console",
                    "outcome": "Identify any Google-imposed restrictions",
                },
                {
                    "action": "Review recent site changes in version control",
                    "tool": "Git / CMS",
                    "outcome": "Identify potential technical causes",
                },
                {
                    "action": "Analyze top landing pages for traffic changes",
                    "tool": "Google Analytics",
                    "outcome": "Pinpoint affected pages",
                },
            ],
            MetricType.KEYWORD_RANKING: [
                {
                    "action": "Compare current SERP with previous snapshot",
                    "tool": "SERP tracker",
                    "outcome": "Identify what changed in search results",
                },
                {
                    "action": "Analyze content quality vs new ranking pages",
                    "tool": "Content analyzer",
                    "outcome": "Identify content gaps",
                },
            ],
            MetricType.CTR: [
                {
                    "action": "Review title tags and meta descriptions",
                    "tool": "SEO audit tool",
                    "outcome": "Identify snippet optimization opportunities",
                },
                {
                    "action": "Check for new SERP features affecting clicks",
                    "tool": "SERP analyzer",
                    "outcome": "Understand SERP layout changes",
                },
            ],
        }
        
        return steps_by_metric.get(metric_type, [
            {
                "action": "Review metric data in detail",
                "tool": "Analytics platform",
                "outcome": "Understand the scope of the change",
            },
        ])
    
    def _generate_recommended_actions(self, anomaly: Anomaly) -> list[str]:
        """Generate recommended actions based on anomaly."""
        actions: list[str] = []
        
        if anomaly.is_negative:
            if anomaly.metric_type == MetricType.ORGANIC_TRAFFIC:
                actions.extend([
                    "Audit technical SEO for any crawling/indexing issues",
                    "Review and refresh underperforming content",
                    "Check for algorithm update impacts",
                ])
            elif anomaly.metric_type == MetricType.KEYWORD_RANKING:
                actions.extend([
                    "Analyze competitor content that outranks you",
                    "Update content to better match search intent",
                    "Strengthen internal linking to affected pages",
                ])
            elif anomaly.metric_type == MetricType.CTR:
                actions.extend([
                    "A/B test different title variations",
                    "Enhance meta descriptions with compelling CTAs",
                    "Add structured data for rich snippets",
                ])
            else:
                actions.append("Investigate root cause before taking action")
        else:
            # Positive anomaly
            actions.extend([
                "Identify what's working and replicate it",
                "Monitor to ensure gains are sustained",
                "Document successful tactics for future reference",
            ])
        
        return actions[:5]  # Max 5 actions
