-- SQL Server script for MobileHub
CREATE DATABASE MobileHub;
GO

USE MobileHub;
GO

CREATE TABLE users (
  id NVARCHAR(255) NOT NULL PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  email NVARCHAR(255) NOT NULL UNIQUE,
  passwordHash NVARCHAR(MAX) NOT NULL,
  role NVARCHAR(50) DEFAULT 'customer',
  createdAt DATETIME NOT NULL
);
GO

CREATE TABLE sessions (
  session_token NVARCHAR(255) NOT NULL PRIMARY KEY,
  user_id NVARCHAR(255) NOT NULL
);
GO

CREATE TABLE products (
  id NVARCHAR(255) NOT NULL PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  storage NVARCHAR(255) NOT NULL,
  color NVARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL,
  image NVARCHAR(MAX),
  blurb NVARCHAR(MAX),
  createdAt DATETIME NOT NULL
);
GO

CREATE TABLE orders (
  reference NVARCHAR(255) NOT NULL PRIMARY KEY,
  userId NVARCHAR(255) NOT NULL,
  productId NVARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status NVARCHAR(50) NOT NULL,
  delivery NVARCHAR(MAX) CHECK (ISJSON(delivery) = 1),
  createdAt DATETIME NOT NULL
);
GO

CREATE TABLE messages (
  id NVARCHAR(255) NOT NULL PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  email NVARCHAR(255) NOT NULL,
  phone NVARCHAR(255) NULL,
  subject NVARCHAR(255) NULL,
  message NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(50) DEFAULT 'new',
  createdAt DATETIME NOT NULL,
  emailSent BIT DEFAULT 0,
  emailTo NVARCHAR(255) NULL,
  emailProvider NVARCHAR(255) NULL,
  emailError NVARCHAR(MAX) NULL
);
GO

INSERT INTO products (id, name, storage, color, price, stock, image, blurb, createdAt)
VALUES
  ('ip15-128-black', 'iPhone 15', '128GB', 'Black', 17999.00, 12, 'https://images.unsplash.com/photo-1697284959429-19c9c5c7a3e2?auto=format&fit=crop&w=600&q=80', 'The everyday iPhone. A16 Bionic, 48MP main camera, USB-C.', GETDATE()),
  ('ip15pro-256-titanium', 'iPhone 15 Pro', '256GB', 'Natural Titanium', 27999.00, 8, 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=600&q=80', 'Titanium build, A17 Pro chip, and the Action button.', GETDATE()),
  ('ip15promax-512-blue', 'iPhone 15 Pro Max', '512GB', 'Blue Titanium', 34999.00, 5, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=600&q=80', '5x telephoto, the biggest screen, all-day battery life.', GETDATE()),
  ('ip14-128-blue', 'iPhone 14', '128GB', 'Blue', 14999.00, 15, 'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?auto=format&fit=crop&w=600&q=80', 'Great value, Crash Detection, and a 12MP dual-camera system.', GETDATE()),
  ('ip13-128-midnight', 'iPhone 13', '128GB', 'Midnight', 11999.00, 20, 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=600&q=80', 'Still fast, still capable, still an iPhone. Best budget pick.', GETDATE()),
  ('ipse-64-starlight', 'iPhone SE', '64GB', 'Starlight', 8999.00, 10, 'https://images.unsplash.com/photo-1616348436168-de43ad0db179?auto=format&fit=crop&w=600&q=80', 'Classic form, A15 chip, Touch ID. The lightest way in.', GETDATE()),
  ('ip12-64-purple', 'iPhone 12', '64GB', 'Purple', 9499.00, 14, 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=600&q=80', 'The one that started the flat-edge design. Still reliable, still capable.', GETDATE()),
  ('ip16-128-black', 'iPhone 16', '128GB', 'Black', 19999.00, 11, 'https://images.unsplash.com/photo-1697284959429-19c9c5c7a3e2?auto=format&fit=crop&w=600&q=80', 'A18 chip, Camera Control button, and Apple Intelligence on board.', GETDATE()),
  ('ip16pro-256-desert', 'iPhone 16 Pro', '256GB', 'Desert Titanium', 29999.00, 7, 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=600&q=80', 'A18 Pro, 5x telephoto, and the brightest display yet on a Pro.', GETDATE()),
  ('ip16promax-512-titanium', 'iPhone 16 Pro Max', '512GB', 'Black Titanium', 37999.00, 4, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=600&q=80', 'The largest, most capable iPhone available. Built for power users.', GETDATE());
GO

SELECT 'MobileHub database ready' AS status;
GO