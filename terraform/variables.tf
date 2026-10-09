variable "aws_region" {
  description = "AWS region for the private S3 origin."
  type        = string
  default     = "us-east-2"
}

variable "domain_name" {
  description = "Public hostname for the Pokédex, for example pokedex.ditsbits.com."
  type        = string
}

variable "hosted_zone_name" {
  description = "Existing public Route 53 hosted zone containing the hostname."
  type        = string
  default     = "ditsbits.com"
}

variable "tags" {
  description = "Additional tags applied to supported resources."
  type        = map(string)
  default     = {}
}
