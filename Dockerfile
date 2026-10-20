FROM php:8.2-apache

# Cài đặt extension zip (cần thiết cho XlsxReader đọc file .xlsx)
RUN apt-get update && apt-get install -y \
    libzip-dev \
    unzip \
    && docker-php-ext-install zip \
    && rm -rf /var/lib/apt/lists/*

# Bật mod_rewrite
RUN a2enmod rewrite

# Cho phép .htaccess hoạt động trong thư mục web
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Cấu hình dung lượng upload và bộ nhớ cho PHP
RUN echo "upload_max_filesize = 30M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size = 35M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/uploads.ini

# Thiết lập thư mục làm việc và copy mã nguồn
WORKDIR /var/www/html
COPY . /var/www/html/

# Phân quyền cho www-data để có thể ghi dữ liệu vào thư mục data/
RUN chown -R www-data:www-data /var/www/html/data \
    && chmod -R 775 /var/www/html/data

# Tự động đồng bộ cổng Apache theo biến môi trường $PORT của Render (mặc định 10000)
CMD sed -i "s/80/${PORT:-80}/g" /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf && apache2-foreground
