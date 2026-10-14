USE DBCIPCusco;
GO

CREATE TABLE COLEGIADOS (
    COLEGIADO_ID        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    NUM_COLEGIATURA     VARCHAR(20) UNIQUE NOT NULL,
    DNI                 VARCHAR(8) UNIQUE NOT NULL,
    NOMBRES             VARCHAR(100) NOT NULL,
    APELLIDO_PATERNO    VARCHAR(100) NOT NULL,
    APELLIDO_MATERNO    VARCHAR(100),
    FECHA_NACIMIENTO    DATE,
    SEXO                VARCHAR(1),
    ESTADO_COLEGIATURA  VARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
    FECHA_INGRESO       DATE,
    FECHA_VENCIMIENTO   DATE,
    ESPECIALIDAD        VARCHAR(200),
    TELEFONO            VARCHAR(20),
    EMAIL               VARCHAR(255),
    DIRECCION           VARCHAR(500),
    DISTRITO            VARCHAR(100),
    PROVINCIA           VARCHAR(100),
    DEPARTAMENTO        VARCHAR(100)
);
GO

CREATE TABLE CUOTAS_COLEGIATURA (
    CUOTA_ID            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    COLEGIADO_ID        UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES COLEGIADOS(COLEGIADO_ID),
    ANIO                INT NOT NULL,
    MES                 INT NOT NULL,
    MONTO               DECIMAL(12,2) NOT NULL,
    ESTADO_PAGO         VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    FECHA_VENCIMIENTO   DATE NOT NULL,
    FECHA_PAGO          DATETIME2
);
GO

CREATE INDEX idx_cuotas_colegiado ON CUOTAS_COLEGIATURA(COLEGIADO_ID);
GO

-- Colegiados de prueba
INSERT INTO COLEGIADOS (NUM_COLEGIATURA, DNI, NOMBRES, APELLIDO_PATERNO, APELLIDO_MATERNO, FECHA_NACIMIENTO, SEXO, ESTADO_COLEGIATURA, FECHA_INGRESO, ESPECIALIDAD, TELEFONO, EMAIL, DISTRITO, PROVINCIA, DEPARTAMENTO) VALUES
('CIP-0001', '12345678', 'Juan Carlos', 'Perez', 'Lopez', '1980-03-15', 'M', 'ACTIVO', '2005-06-01', 'Derecho Civil', '999111222', 'jperez@email.com', 'San Isidro', 'Lima', 'Lima'),
('CIP-0002', '23456789', 'Maria Elena', 'Garcia', 'Ramirez', '1985-07-22', 'F', 'ACTIVO', '2010-01-15', 'Derecho Penal', '999222333', 'mgarcia@email.com', 'Miraflores', 'Lima', 'Lima'),
('CIP-0003', '34567890', 'Roberto', 'Martinez', 'Sánchez', '1978-11-08', 'M', 'ACTIVO', '2002-09-10', 'Derecho Laboral', '999333444', 'rmartinez@email.com', 'Surco', 'Lima', 'Lima'),
('CIP-0004', '45678901', 'Ana Lucia', 'Rodriguez', 'Flores', '1990-01-30', 'F', 'ACTIVO', '2015-03-20', 'Derecho Familiar', '999444555', 'arodriguez@email.com', 'La Molina', 'Lima', 'Lima'),
('CIP-0005', '56789012', 'Carlos Alberto', 'Torres', 'Vargas', '1975-06-12', 'M', 'ACTIVO', '1998-11-05', 'Derecho Corporativo', '999555666', 'ctorres@email.com', 'San Borja', 'Lima', 'Lima'),
('CIP-0006', '67890123', 'Patricia', 'Morales', 'Cruz', '1988-04-18', 'F', 'ACTIVO', '2012-07-08', 'Derecho Tributario', '999666777', 'pmorales@email.com', 'Pueblo Libre', 'Lima', 'Lima'),
('CIP-0007', '78901234', 'Fernando', 'Castro', 'Rojas', '1982-09-25', 'M', 'ACTIVO', '2007-02-14', 'Derecho Minero', '999777888', 'fcastro@email.com', 'Ate', 'Lima', 'Lima'),
('CIP-0008', '89012345', 'Sandra Mila', 'Herrera', 'Diaz', '1992-12-03', 'F', 'ACTIVO', '2018-05-22', 'Derecho Ambiental', '999888999', 'sherrera@email.com', 'Chorrillos', 'Lima', 'Lima'),
('CIP-0009', '90123456', 'Miguel Angel', 'Lopez', 'Gutierrez', '1970-08-17', 'M', 'SUSPENDIDO', '1995-04-30', 'Derecho Administrativo', '999000111', 'mlopez@email.com', 'Jesus Maria', 'Lima', 'Lima'),
('CIP-0010', '01234567', 'Claudia', 'Ramos', 'Medina', '1987-02-14', 'F', 'ACTIVO', '2011-10-12', 'Derecho Internacional', '999111000', 'cramos@email.com', 'Lince', 'Lima', 'Lima');
GO

PRINT '=== Colegiados de prueba insertados en DBCIPCusco ===';
GO
