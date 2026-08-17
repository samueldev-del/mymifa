# Le budget créé à la main lors de l'inscription alerte en ACTUAL à 0,01 $ :
# il prévient quand la dépense a déjà eu lieu. Celui-ci alerte en FORECASTED,
# c'est-à-dire quand AWS projette un dépassement — ce qui laisse le temps
# d'agir avant que la ressource fautive ait consommé plusieurs jours.
resource "aws_budgets_budget" "monthly_forecast" {
  name         = "mymifa-monthly-forecast"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    # FORECASTED : basé sur la projection de fin de mois, pas sur le réalisé.
    notification_type   = "FORECASTED"
    comparison_operator = "GREATER_THAN"
    # 80 % de 10 $ : on veut être prévenu avant le seuil, pas au moment où
    # il est franchi.
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    subscriber_email_addresses = ["samueldjommou@icloud.com"]
  }

  notification {
    # Doublon volontaire en ACTUAL sur ce seuil plus élevé : si la projection
    # se trompe, le réalisé prend le relais.
    notification_type          = "ACTUAL"
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = ["samueldjommou@icloud.com"]
  }
}